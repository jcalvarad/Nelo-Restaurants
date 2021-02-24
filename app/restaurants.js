const { DynamoDB } = require("aws-sdk");
uuid = require("uuid");

const db = new DynamoDB.DocumentClient();
const TableName = process.env.RESTAURANTS_TABLE;

let response;

exports.create = async (event, context) => {
  try {
    console.log(TableName);
    const restaurant = JSON.parse(event.body);
    const item = {
      id: uuid.v1(),
      name: restaurant.name,
      endorsements: restaurant.endorsements || [],
      tables: restaurant.tables || [],
    };
    const params = {
      TableName,
      Item: item,
    };
    await db.put(params).promise();

    response = {
      statusCode: 200,
      body: JSON.stringify(item),
    };
  } catch (err) {
    console.log(err);
    return err;
  }

  return response;
};
