const { DynamoDB } = require("aws-sdk");
uuid = require("uuid");

const TableName = process.env.USERS_TABLE;

let response;

exports.create = async (event, context) => {
  try {
    const db = new DynamoDB.DocumentClient();

    const user = JSON.parse(event.body);
    const item = {
      id: uuid.v1(),
      name: user.name,
      diet: user.diet,
      reservations: [],
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
