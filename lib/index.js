const fs = require("fs");
const pathLib = require("path");


module.exports = function affMock(api, options, dirname) {
  return {
    visitor: {
      CallExpression(path) {
        if (!api.types.isMemberExpression(path.node.callee)) {
          return;
        }
        const comments = path.node.leadingComments || [];
        const comment = comments.filter((item) => item.value.includes("aff-mock:"))[0];

        if (!comment) {
          return;
        }

        const data = comment.value.split(":");
        const type = data[1].toLocaleLowerCase();
        if (!type || (type !== "reject" && type !== "resolve")) {
          return;
        }

        const pathUrl = data[2].trim();
        if (!fs.existsSync(pathLib.join(process.cwd(), pathUrl))) {
          return;
        }

        const mockData = JSON.stringify(Function(`return ${fs.readFileSync(pathLib.join(process.cwd(), pathUrl)).toString()}`)());
        console.log(mockData);

        let replaceExpression = "";

        if (type === "resolve") {
          replaceExpression = api.template.ast(`Promise.resolve((function(){console.error("Mocking ... Mocking");console.error("Mocking ... Mocking");return ${mockData};})())`);
        }

        if (type === "reject") {
          replaceExpression = api.template.ast(`Promise.reject((function(){console.error("Mocking ... Mocking");console.error("Mocking ... Mocking");return ${mockData};})())`);
        }

        if (!replaceExpression) {
          return;
        }
        path.replaceWith(replaceExpression);
        path.skip();
      }
    }
  };
}
