const { GlobalKeyboardListener } = require("node-global-key-listener");
const { io } = require("socket.io-client");

const exceptionKey = ["p", "d", "l", "x"];

const gkl = new GlobalKeyboardListener();
const socket = io("https://c-link.co.kr"); // ← 실제 I 서버 주소로 수정
const express = require("express");
const app = express();

let isController = false;

socket.on("connect", () => {
  console.log("[A] I 서버에 연결됨");
  socket.emit("register", "m");
});

socket.on("register", (msg) => {
  console.log("[I → A] 수신 메시지:", msg);
});

socket.on("msg", (msg) => {
  console.log("[I → A] 수신 메시지:", msg);
  isController = msg;
});

// 키 입력감지인데, 윈도우만 가능..
gkl.addListener((e) => {
  if (e.name.toLowerCase().includes("mouse")) return;

  // 키다운
  if (e.state === "DOWN") {
    const key = e.name.toLowerCase();
    // 컨트롤러 조작이 아닌경우 굳이 보내지 않음
    if (!isController) return;
    console.log(`[A] 키 다운: ${key}`, isController);
    socket.emit("keyDown", key.replaceAll(" ", ""));
    return;
  }

  // 키업

  const key = e.name.toLowerCase();
  console.log(`[A] 키 업: ${key}`, isController);
  if (isController) {
    socket.emit("keyUp", key.replaceAll(" ", ""));
    return;
  }
  if (key === "0") {
    socket.emit("toggleController", "0");
    return;
  }
  if (key === "9") {
    socket.emit("toggleController", "9");
    return;
  }
  if (key === "l") {
    socket.emit("settingLoreCnt", "l");
    return;
  }
  if (key === "x") {
    socket.emit("toggleLore", "x");
    return;
  }

  if (!isController) return;

  // socket.emit("keyUp", key.replaceAll(" ", ""));
  return;
});

app.listen(8080, () => {
  console.log("서버 실행 중...");
});
