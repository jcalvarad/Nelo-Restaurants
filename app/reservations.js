const { DynamoDB } = require("aws-sdk");
uuid = require("uuid");
moment = require("moment");

const ReservationsTable = process.env.RESERVATIONS_TABLE;
const UsersTable = process.env.USERS_TABLE;
const RestaurantsTable = process.env.RESTAURANTS_TABLE;

let response;

exports.available = async (event, context) => {
  try {
    const db = new DynamoDB.DocumentClient();
    const queryParams = event.queryStringParameters;
    const requestUsers = queryParams.users.split(",");
    const dateFrom = queryParams.dateFrom;
    const dateTo = queryParams.dateTo;

    //Get users
    const userGetParams = {
      RequestItems: {},
    };
    userGetParams.RequestItems[UsersTable] = {
      Keys: requestUsers.map((userId) => ({ id: userId })),
    };
    const users = await db
      .batchGet(userGetParams)
      .promise()
      .then((result) => result.Responses.users);

    //Get users' diet
    const usersDiets = [...new Set(users.map((user) => user.diet))];

    //Available restaurants by diet
    const ExpressionAttributeValues = usersDiets.reduce((prev, curr, i) => {
      prev[":r" + i] = curr;
      return prev;
    }, {});
    const FilterExpression = Object.keys(ExpressionAttributeValues).reduce(
      (prev, curr, i) => {
        if ((i = 0)) return prev;
        prev += ` AND contains(#endorsements, ${curr})`;
        return prev;
      },
      "contains(#endorsements, :r0)"
    );

    const restaurantsGetParams = {
      TableName: RestaurantsTable,
      FilterExpression,
      ExpressionAttributeNames: { "#endorsements": "endorsements" },
      ExpressionAttributeValues,
    };
    const restaurantsResult = await db
      .scan(restaurantsGetParams)
      .promise()
      .then((res) => res.Items);

    //Filter restaurants by tables according to diners
    const availableRestaurants = restaurantsResult.reduce((acc, rest) => {
      rest.tables = rest.tables.filter((table) => table.seats >= users.length);
      if (rest.tables.length > 0) acc.push(rest);
      return acc;
    }, []);

    //Check if time available
    const reservationsPromises = [];
    availableRestaurants.forEach((restaurant) => {
      restaurant.tables.forEach((table) => {
        const reservationsGetParams = {
          TableName: ReservationsTable,
          KeyConditionExpression: "#id = :id and #date between :from and :to",
          ExpressionAttributeNames: {
            "#id": "id",
            "#date": "date",
          },
          ExpressionAttributeValues: {
            ":from": dateFrom,
            ":to": dateTo,
            ":id": restaurant.id + "-" + table.number,
          },
        };

        reservationsPromises.push(
          db
            .query(reservationsGetParams)
            .promise()
            .then((res) => res.Items)
        );
      });
    });
    const resultReservations = await Promise.all(
      reservationsPromises
    ).then((r) => r.flat());

    //Remove tables with reservations at that time
    resultReservations.forEach((reservation) => {
      const findIndex = availableRestaurants.findIndex(
        (rest) => rest.id === reservation.restaurantId
      );
      if (findIndex !== undefined) {
        const tables = availableRestaurants[findIndex].tables.filter(
          (table) => table.number != reservation.tableNumber
        );
        if (tables.length > 0) {
          availableRestaurants[findIndex].tables = tables;
        } else {
          availableRestaurants.splice(findIndex, 1);
        }
      }
    });

    //return response
    response = {
      statusCode: 200,
      body: JSON.stringify(availableRestaurants),
    };
  } catch (err) {
    console.log(err);
    return err;
  }

  return response;
};

exports.create = async (event, context) => {
  try {
    const db = new DynamoDB.DocumentClient();
    const request = JSON.parse(event.body);
    const reservationId = request.restaurantId + "-" + request.tableNumber;

    //Validate users don't have an overlapping reservation
    const requestUsers = request.users;
    const userGetParams = {
      RequestItems: {},
    };
    userGetParams.RequestItems[UsersTable] = {
      Keys: requestUsers.map((userId) => ({ id: userId })),
    };
    const users = await db
      .batchGet(userGetParams)
      .promise()
      .then((result) => result.Responses.users);
    users.forEach((user) => {
      user.reservations.forEach((reservation) => {
        if (
          moment(reservation.date).isBetween(
            moment(request.date).subtract(2, "hours"),
            moment(request.date).add(2, "hours"),
            undefined,
            "[]"
          )
        )
          throw "DuplicateReservation";
      });
    });

    //Create reservation
    const reservationItem = {
      id: reservationId,
      date: request.date,
      users: request.users,
      restaurantId: request.restaurantId,
      tableNumber: request.tableNumber,
    };
    const reservationParams = {
      TableName: ReservationsTable,
      Item: reservationItem,
    };
    await db.put(reservationParams).promise();

    //Add reservation details to users
    const userPromises = [];
    users.forEach((user) => {
      const userParams = {
        TableName: UsersTable,
        Key: { id: user.id },
        UpdateExpression: "set  reservations = :r",
        ExpressionAttributeValues: {
          ":r": [
            ...user.reservations,
            { id: reservationId, date: request.date },
          ],
        },
      };
      userPromises.push(db.update(userParams).promise());
    });
    const resultUsers = await Promise.all(userPromises).then((r) => r.flat());

    response = {
      statusCode: 200,
      body: JSON.stringify(resultUsers),
    };
  } catch (err) {
    console.log(err);
    if (err == "DuplicateReservation")
      return {
        statusCode: 409,
        body: "A user already has a reservation at this time",
      };
    return err;
  }

  return response;
};

exports.delete = async (event, context) => {
  try {
    console.log(event);
    const reservation = JSON.parse(event.body);
    const params = {
      TableName: ReservationsTable,
      Key: {
        id: reservation.restaurantId + "-" + reservation.tableNumber,
        date: reservation.date,
      },
    };
    await db.delete(params).promise();

    response = {
      statusCode: 204,
    };
  } catch (err) {
    console.log(err);
    return err;
  }

  return response;
};
