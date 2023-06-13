const fs = require("fs");
const pathLib = require("path");

/** @typedef {import("@babel/types")} babel */
/** @typedef {import("@babel/types").MemberExpression} MemberExpression */
/** @typedef {import("@types/babel__traverse/index").NodePath} NodePath */

module.exports = function affMock(api, options, dirname) {
  /** @type {babel} */
  const types = api.types;
  return {
    visitor: {
      /**
       *
       * @param {NodePath} path
       * @returns
       */
      ExpressionStatement(path) {
        if (!types.isAssignmentExpression(path.node.expression)) {
          return;
        }
        /** @type {MemberExpression} */
        const left = path.node.expression.left;
        if (!types.isIdentifier(left.property)) {
          return;
        }

        collectMock(api, path);
      },
      /**
       *
       * @param {NodePath} path
       * @returns
       */
      CallExpression(path) {
        try {
          if (!api.types.isMemberExpression(path.node.callee)) {
            return;
          }
          generateMock(api, path);
        } catch (e) {
          console.error(e);
        }
      },
    },
  };
};

function generateMock(api, path) {
  try {
    const comments = path.node.leadingComments || [];
    const affMockComments = comments.filter((item) =>
      item.value.includes("aff-mock-request"),
    );
    let comment = affMockComments[0];

    if (!comment) {
      return;
    }

    const replaceExpression = api.template.ast(`
    Promise.resolve((function(){
      if (!global[propertyName]) {
        return https[propertyName]({
          data: requestData
        });
      }

      console.error("Mocking ... Mocking");
      console.error("Mocking ... Mocking");

      var mockData = global[propertyName];

      var isResolve = !!mockData.resolve;
      if (isResolve) {
        return Promise.resolve(mockData.resolve);
      }
      return Promise.reject(mockData.reject);
    })());
    `);

    if (!replaceExpression) {
      return;
    }

    path.replaceWith(replaceExpression);
    path.skip();
  } catch (e) {
    console.error(e);
  }
}

/**
 *
 * @param {*} api
 * @param {NodePath} path
 * @returns
 */
function collectMock(api, path) {
  try {
    /** @type {MemberExpression} */
    const left = path.node.expression.left;
    if (!api.types.isIdentifier(left.property)) {
      return;
    }
    const propertyName = left.property.name;

    if (!propertyName) {
      return;
    }

    const comments = path.node.leadingComments || [];
    const affMockComments = comments.filter((item) =>
      item.value.includes("aff-mock:"),
    );
    let comment = affMockComments[0];

    if (!comment) {
      return;
    }

    let data = comment.value.split(":");
    const index = Number(data[data.length - 1]) || 1;

    comment = affMockComments[index - 1];

    if (!comment) {
      return;
    }

    data = comment.value.split(":");

    const pathUrl = data[1].trim();
    if (!fs.existsSync(pathLib.join(process.cwd(), pathUrl))) {
      return;
    }

    const type = pathLib
      .basename(pathUrl)
      .replace(pathLib.extname(pathUrl), "")
      .split(".")
      .pop();
    if (!type || (type !== "reject" && type !== "resolve")) {
      return;
    }

    const mockData = JSON.stringify(
      Function(
        `return ${fs
          .readFileSync(pathLib.join(process.cwd(), pathUrl))
          .toString()}`,
      )(),
    );

    const replaceExpression = api.template.ast(
      `if (!global.${propertyName}) {
        global.${propertyName} = {};
      }`,
    );

    const replaceExpression1 = api.template.ast(
      `global.${propertyName}.${type} = ${mockData};`,
    );

    if (!replaceExpression) {
      return;
    }

    if (!api.types.isBlockStatement(path.parent)) {
      return;
    }
    path.parent.body.unshift(replaceExpression, replaceExpression1);
    path.skip();
  } catch (e) {
    console.error(e);
  }
}
