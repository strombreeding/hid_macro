const { io } = require("socket.io-client");
const { SerialPort } = require("serialport");
const fs = require("fs");
const path = require("path");
// 소켓 서버 주소
const SOCKET_SERVER = "https://c-link.co.kr";

let port;

let loreInterval = false;
let petFeed = 0;
let loreTimer = null;

// 라즈베리파이를 식별할 수 있는 패턴들 (경우에 따라 수정 가능)
const POSSIBLE_PATTERNS = [
  "usbmodem",
  "usbserial",
  "wchusbserial", // CH340/CP210x 계열
  "ttyAMA", // 일부 라즈베리파이 시리얼
];

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

const emitLore = () => {
  if (!loreInterval) return;
  console.log("로어 키 입력");

  port.write("keyDown leftshift\n");
  new Promise((resolve) => setTimeout(resolve, 2200));
  port.write("keyUp leftshift\n");

  petFeed++;
  if (petFeed >= 100) {
    petFeed = 0;
    emitPetFeed();
  }

  const randomTime = Math.random() * 1000 + 1500;

  loreTimer = setTimeout(() => {
    emitLore();
  }, randomTime);
};

const emitPetFeed = () => {
  if (port == null) return;
  port.write("keyDown d\n");
  new Promise((resolve) => setTimeout(resolve, 150));
  port.write("keyUp d\n");
};

const startLore = () => {
  loreInterval = true;
  emitLore();
};

const stopLore = () => {
  clearTimeout(loreTimer);
  loreTimer = null;
  loreInterval = false;
};

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
      console.log("[D] I 서버에 연결됨");
      socket.emit("register", "d");
    });

    socket.on("msg", (msg) => {
      console.log("[I → D] 수신 메시지:", msg);
    });

    socket.on("lore", (msg) => {
      if (msg === "start") {
        loreInterval = true;
        startLore();
        console.log("로어 시작");
      }

      if (msg === "stop") {
        loreInterval = false;
        stopLore();
        console.log("로어 중지");
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
