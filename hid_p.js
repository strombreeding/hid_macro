const { io } = require("socket.io-client");
const { SerialPort } = require("serialport");
const fs = require("fs");
const path = require("path");
// 소켓 서버 주소
const SOCKET_SERVER = "https://c-link.co.kr";
const player = require("play-sound")();
const express = require("express");
const app = express();
// 라즈베리파이를 식별할 수 있는 패턴들 (경우에 따라 수정 가능)
const POSSIBLE_PATTERNS = [
  "usbmodem",
  "usbserial",
  "wchusbserial", // CH340/CP210x 계열
  "ttyAMA", // 일부 라즈베리파이 시리얼
];

let healTimer = null;
let healInterval = null;
let petFeed = 0;
let port;
let plaing = false;

const emitHeal = () => {
  if (!healInterval) return;
  const randomHealTime = Math.random() * 1000 + 1000;

  port.write("keyDown leftctrl\n");
  new Promise((resolve) => setTimeout(resolve, 300));
  port.write("keyUp leftctrl\n");

  petFeed++;
  if (petFeed >= 100) {
    petFeed = 0;
    emitPetFeed();
  }

  setTimeout(() => {
    emitHeal();
  }, randomHealTime);
};

const emitPetFeed = () => {
  if (port == null) return;
  port.write("keyDown d\n");
  new Promise((resolve) => setTimeout(resolve, 50));
  port.write("keyUp d\n");
};

const startHeal = () => {
  healInterval = true;
  emitHeal();
  console.log("힐 시작");
};

const stopHeal = () => {
  clearTimeout(healTimer);
  healTimer = null;
  healInterval = false;
  console.log("힐 중지");
};

async function findPiPort() {
  const deviceDir = "/dev";
  const entries = fs.readdirSync(deviceDir);

  const candidates = entries
    .filter((name) =>
      POSSIBLE_PATTERNS.some((pattern) => name.includes(pattern))
    )
    .map((name) => path.join(deviceDir, name));

  if (candidates.length === 0) {
    throw new Error("라즈베리파이로 보이는 시리얼 포트를 찾을 수 없습니다.");
  }

  // 여기선 일단 첫 번째 후보 사용하지만, 나중에 더 정교한 필터링 가능
  return candidates[0];
}

async function main() {
  try {
    const serialPath = await findPiPort();

    port = new SerialPort({
      path: serialPath,
      baudRate: 115200,
    });

    port.on("open", () => {
      console.log("시리얼 포트 열림:", serialPath);
    });

    port.on("error", (err) => {
      console.error("시리얼 포트 에러:", err.message);
    });

    // 소켓 연결
    const socket = io(SOCKET_SERVER);

    socket.on("connect", () => {
      console.log("[P] I 서버에 연결됨");
      socket.emit("register", "p");
    });

    socket.on("msg", (msg) => {
      console.log("[I → P] 수신 메시지:", msg);
    });

    socket.on("heal", (msg) => {
      console.log("[I → P] 수신 메시지:", msg);
      if (msg === "start") {
        startHeal();
        return;
      }
      if (msg === "stop") {
        stopHeal();
        return;
      }
    });

    socket.on("keyDown", (key) => {
      const msg = `keyDown ${key}\n`;
      console.log("[Socket] keyDown -> 시리얼 전송:", msg.trim());
      port.write(msg);
    });

    socket.on("keyUp", (key) => {
      const msg = `keyUp ${key}\n`;
      console.log("[Socket] keyUp -> 시리얼 전송:", msg.trim());
      port.write(msg);
    });

    socket.on("disconnect", () => {
      console.log("소켓 서버 연결 끊김");
    });
  } catch (err) {
    console.error("에러 발생:", err.message);
  }
}

main();

app.listen(8083, () => {
  console.log("서버 실행 중");
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
