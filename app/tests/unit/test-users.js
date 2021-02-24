"use strict";
const AWSMock = require("aws-sdk-mock");
const AWS = require("aws-sdk");
const app = require("../../users.js");
const chai = require("chai");
const expect = chai.expect;
var event, context;

describe("Test User", function () {
  const eventCreate = { body: `{"name":"John","diet":"Paleo"}` };
  it("creates a user", async () => {
    process.env.USERS_TABLE = "Users_Table";
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock("DynamoDB.DocumentClient", "put", function (params, callback) {
      callback(null, {
        id: "8c70f690-7640-11eb-af31-d9467affb50a",
        name: "John",
        diet: "Paleo",
        reservations: [],
      });
    });
    const result = await app.create(eventCreate, context);

    expect(result.statusCode).to.equal(200);
    expect(JSON.parse(result.body)).to.include({ name: "John", diet: "Paleo" });
  });
});
