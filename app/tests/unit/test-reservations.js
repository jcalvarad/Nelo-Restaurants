"use strict";
const AWSMock = require("aws-sdk-mock");
const AWS = require("aws-sdk");
const app = require("../../reservations.js");
const chai = require("chai");
const expect = chai.expect;
var event, context;

describe("Test Reservations", function () {
  const eventCreate = {
    queryStringParameters: {
      users: "id1,id2",
      dateFrom: "2021-02-23T16:30",
      dateTo: "2021-02-23T18:30",
    },
  };
  it("checks available reservations", async () => {
    process.env.USERS_TABLE = "Users_Table";
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock(
      "DynamoDB.DocumentClient",
      "batchGet",
      function (params, callback) {
        callback(null, {
          Responses: {
            users: [
              { id: "id1", diet: "Paleo", reservations: [] },
              { id: "id2", diet: "Paleo", reservations: [] },
            ],
          },
        });
      }
    );
    AWSMock.mock(
      "DynamoDB.DocumentClient",
      "scan",
      function (params, callback) {
        callback(null, {
          Items: [
            {
              endorsements: ["Vegetarian", "Paleo"],
              tables: [
                {
                  reservations: [],
                  number: 1,
                  seats: 4,
                },
              ],
              id: "57ecf680-7546-11eb-b84b-c1afe807d2e6",
              name: "Reo Salon",
            },
          ],
        });
      }
    );
    AWSMock.mock(
      "DynamoDB.DocumentClient",
      "query",
      function (params, callback) {
        callback(null, { Items: [] });
      }
    );
    const result = await app.available(eventCreate, context);

    expect(result.statusCode).to.equal(200);
    expect(JSON.parse(result.body)).to.be.an("array");
    expect(JSON.parse(result.body)[0]).to.an("object");
  });

  it("checks validates duplicate reservation", async () => {
    process.env.USERS_TABLE = "Users_Table";
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock(
      "DynamoDB.DocumentClient",
      "batchGet",
      function (params, callback) {
        callback(null, {
          Responses: {
            users: [
              { id: "id1", diet: "Paleo", reservations: [] },
              {
                id: "id2",
                diet: "Paleo",
                reservations: [{ date: "2021-02-23T16:30" }],
              },
            ],
          },
        });
      }
    );
    AWSMock.mock(
      "DynamoDB.DocumentClient",
      "scan",
      function (params, callback) {
        callback(null, {
          Items: [
            {
              endorsements: ["Vegetarian", "Paleo"],
              tables: [
                {
                  reservations: [],
                  number: 1,
                  seats: 4,
                },
              ],
              id: "57ecf680-7546-11eb-b84b-c1afe807d2e6",
              name: "Reo Salon",
            },
          ],
        });
      }
    );
    AWSMock.mock(
      "DynamoDB.DocumentClient",
      "query",
      function (params, callback) {
        callback(null, { Items: [] });
      }
    );
    const result = await app.create(eventCreate, context);

    expect(result.statusCode).to.equal(409);
  });
});
