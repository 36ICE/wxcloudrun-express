const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB, Counter } = require("./db");
const crypto = require('crypto');
const logger = morgan("tiny");
const getRawBody = require("raw-body")
const xml2js = require("xml2js");
const cron = require("node-cron");
const axios = require("axios");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);
app.use(express.raw({ type: "text/xml" }));
/**
 * req.params：包含通过路由参数传递的值（例如，app.get("/users/:id") 中的 id 值）。
req.query：包含查询字符串参数的对象（例如，/users?name=john&age=25 中的 name 和 age）。
req.body：包含 POST 请求的请求体参数（需要使用中间件如 body-parser 解析）。
req.headers：包含请求的头部信息。
req.cookies：包含客户端发送的所有 Cookie。
req.method：表示请求的 HTTP 方法（GET、POST、PUT 等）。
req.url：表示请求的 URL。
 * 
 */

/**
 * 
 * res.send()：发送响应给客户端，可以发送文本、HTML、JSON 等。
res.json()：发送 JSON 响应给客户端。
res.sendFile()：发送文件作为响应给客户端。
res.redirect()：重定向客户端到另一个 URL。
res.status()：设置响应的 HTTP 状态码。
res.cookie()：设置响应的 Cookie。
res.setHeader()：设置响应的头部信息。
 */
// 首页
app.get("/", async (req, res) => {
  // res.sendFile(path.join(__dirname, "index.html"));
  /**
   * URL参数中的signature签名过程：
1. 将token、timestamp（URL参数中的）、nonce（URL参数中的）三个参数进行字典序排序，排序后结果为:["1159381888","1717232444","zxc"]
2. 将三个参数字符串拼接成一个字符串："11593818881717232444zxc"
3. 进行sha1签名计算：d63f4edc9a1acdb744088025c11dc63a978029fd
4. 开发者需按照此流程计算签名并与URL参数中的signature进行对比验证，相等则验证通过
   * 
   */
  //todo 接口更新token
  const token = "zxc";
  const { signature, echostr, timestamp, nonce } = req.query;
  // 将 token、timestamp、nonce 参数进行字典序排序
  const sortedParams = [token, timestamp, nonce].sort();

  // 将排序后的参数拼接成一个字符串
  const sortedParamsStr = sortedParams.join("");

  // 使用 sha1 算法计算签名
  console.log("sortedParamsStr:" + sortedParamsStr);
  const generatedSignature = crypto.createHash("sha1").update(sortedParamsStr).digest("hex");
  console.log("generatedSignature:" + generatedSignature);


  // 验证签名是否匹配
  if (generatedSignature === signature) {
    // 签名验证通过，可以继续处理逻辑
    res.send(echostr);
  } else {
    // 签名验证失败
    res.send("Signature verification failed.");
  }


});
app.post("/", async (req, res) => {
  //todo 接口更新token

  xml2js.parseString(req.body.toString(), { explicitArray: false }, (err, result) => {
    if (err) {
      console.error("Error parsing XML:", err);
      return res.status(500).send();
    }

    const message = result.xml; // 解析后的消息对象

    // 根据消息类型进行处理
    if (message.MsgType === "text") {
      // 处理文本消息
      const responseData = {
        ToUserName: message.FromUserName,
        FromUserName: message.ToUserName,
        CreateTime: Math.floor(Date.now() / 1000),
        MsgType: "text",
        Content: "你发送了文本消息：" + message.Content
      };

      const builder = new xml2js.Builder({ rootName: "xml", cdata: true });
      const responseXml = builder.buildObject(responseData);

      res.set("Content-Type", "text/xml");
      res.send(responseXml);
    } else if (message.MsgType === "event") {
      // 处理事件
      if (message.Event === "subscribe") {
        // 处理订阅事件
        const responseData = {
          ToUserName: message.FromUserName,
          FromUserName: message.ToUserName,
          CreateTime: Math.floor(Date.now() / 1000),
          MsgType: "text",
          Content: "欢迎订阅公众号！"
        };
        res.set("Content-Type", "text/xml");
        res.send(responseData);
      } else if (message.Event === "CLICK") {
        // 处理点击菜单事件
        const responseData = {
          ToUserName: message.FromUserName,
          FromUserName: message.ToUserName,
          CreateTime: Math.floor(Date.now() / 1000),
          MsgType: "text",
          Content: "你点击了菜单：" + message.EventKey
        };
        res.set("Content-Type", "text/xml");
        res.send(res, responseData);
      } else {
        // 其他事件类型的处理
        res.set("Content-Type", "text/xml");
        res.send();
      }
    } else {
      // 其他消息类型的处理 
      res.set("Content-Type", "text/xml");
      res.send("暂时无法处理的消息");
    }
  });

});


// 定时任务：每天发送模板消息给用户
cron.schedule("0 0 */1 * * *", () => {
  const templateData = {
    touser: "ofFlo6sYxYXQ-BrX8m2xpPICuVI4",
    template_id: "W_H3i7fhfbnuZRscZvA9HBlroOE4SzzXDf2bIfNwFMs",
    // "url": "http://weixin.qq.com/download",
    // "miniprogram": {
    //   "appid": "xiaochengxuappid12345",
    //   "pagepath": "index?foo=bar"
    // },
    data: {
      "keyword1": {
        "value": "巧克力"
      },
      "keyword2": {
        "value": "39.8元"
      },
      "keyword3": {
        "value": "2014年9月22日"
      }
    }
  };

  // 使用 axios 发送 POST 请求调用微信模板消息接口
  //注意有两个appid和 appsecret
  axios.post("https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=81_IRAdKm59TJ4jUDVmM6UnbtTjZFkXwbdulPpXJe83pJaB7IoPkixr03ujYfmZ2iOLr2nCro4wFdFuYgqaOchYgCkpqLlxhHCAohHpJiEDBsL7CdDLpuYB7FP6kJgKSJaACANVM", templateData)
    .then(response => {
      console.log("Template message sent successfully" + response.data.errmsg);
    })
    .catch(error => {
      console.error("Failed to send template message:", error);
    });
});

// 更新计数
app.post("/api/count", async (req, res) => {
  const { action } = req.body;
  if (action === "inc") {
    await Counter.create();
  } else if (action === "clear") {
    await Counter.destroy({
      truncate: true,
    });
  }
  res.send({
    code: 0,
    data: await Counter.count(),
  });
});

// 获取计数
app.get("/api/count", async (req, res) => {
  const result = await Counter.count();
  res.send({
    code: 0,
    data: result,
  });
});

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});

const port = process.env.PORT || 80;

async function bootstrap() {
  await initDB();
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
