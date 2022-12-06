const fs = require("fs");
const pathLib = require("path");


module.exports = function affMock(api, options, dirname) {
  return {
    visitor: {
      CallExpression(path) {
        try {
          if (!api.types.isMemberExpression(path.node.callee)) {
            return;
          }
          const comments = path.node.leadingComments || [];
          const affMockComments = comments.filter((item) => item.value.includes("aff-mock:"));
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
  
          const type = pathLib.basename(pathUrl).replace(pathLib.extname(pathUrl), "").split(".").pop();
          if (!type || (type !== "reject" && type !== "resolve")) {
            return;
          }
  
          const mockData = JSON.stringify(Function(`return ${fs.readFileSync(pathLib.join(process.cwd(), pathUrl)).toString()}`)());
  
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
        } catch (e) {
          console.error(e);
        }
      }
    }
  };
}
