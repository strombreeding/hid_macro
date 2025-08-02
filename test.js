const express = require("express");
const player = require("play-sound")();

const app = express();

let plaing = false;

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("/check", (req, res) => {
  if (plaing) {
    res.send("already playing");
    return;
  }
  plaing = true;
  player.play("./alaram.mp3", (err) => {
    if (err) {
      console.log("오디오 재생 중 오류 발생:", err);
    }
  });
  setTimeout(() => {
    plaing = false;
  }, 22000);
  res.send("ok");
});

app.listen(8083, () => {
  console.log("서버 실행 중");
});
