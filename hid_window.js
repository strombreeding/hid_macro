const { GlobalKeyboardListener } = require("node-global-key-listener");
const { io } = require("socket.io-client");

const gkl = new GlobalKeyboardListener();
const socket = io("http://localhost:3000"); // ← 실제 I 서버 주소로 수정
const express = require("express");
const app = express();

socket.on("connect", () => {
  console.log("[A] I 서버에 연결됨");
  socket.emit("register", "m");
});

socket.on("msg", (msg) => {
  console.log("[I → A] 수신 메시지:", msg);
});

// 키입력 get으로 해보기
app.get("/key", (req, res) => {
  const key = req.query.key;
  if (key === "p") {
    socket.emit("toggleController", "p");
    return;
  }
  if (key === "d") {
    socket.emit("toggleController", "d");
    return;
  }
  if (key === "l") {
    socket.emit("settingLoreCnt", "l");
    return;
  }

  socket.emit("key", key);

  console.log(`[A] 키 입력: ${key}`);
  res.send("OK");
});

// 키 입력감지인데, 윈도우만 가능..
// gkl.addListener((e) => {
//   if (e.state === "DOWN") {
//     const key = e.name.toLowerCase();
//     console.log(`[A] 키 입력: ${key}`);
//     if (key === "p") {
//       console.log("[A] 'p' 키 → B 전송");
//       socket.emit("key", { target: "p", value: "p 키 눌림" });
//     } else if (key === "d") {
//       console.log("[A] 'd' 키 → C 전송");
//       socket.emit("key", { target: "d", value: "d 키 눌림" });
//     } else {
//       socket.emit("key", { target: "broadcast", value: key });
//     }
//   }
// });

app.listen(8080, () => {
  console.log("서버 실행 중...");
});
