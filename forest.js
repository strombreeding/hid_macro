const express = require("express");
const { SerialPort } = require("serialport");
const fs = require("fs");
const path = require("path");
const app = express();
const { io } = require("socket.io-client");

let port;
const SOCKET_SERVER = "https://c-link.co.kr";
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

app.use(express.json());

let firstExec = false;
let isLeft = true;
let execing = false;
// 우측끝 2660
// 좌측끝 250
const execKeys = new Set();

app.get("/xy", (req, res) => {
  const { x, y, px, side } = req.query;
  if (!execing) {
    firstExec = false;
    port.write("keyUp leftarrow\n");
    port.write("keyUp rightarrow\n");
    port.write("keyUp leftshift\n");
    port.write("keyUp x\n");
    port.write("keyUp leftctrl\n");
    port.write("keyUp pagedown\n");
    port.write("keyUp pageup\n");
    port.write("keyUp end\n");
    execKeys.clear();
    return res.send("ok");
  }
  if (!firstExec) {
    firstExec = true;
    console.log("첫 실행");
    port.write("keyDown leftarrow\n");
    execKeys.add("left");
    res.send("ok");
    return;
  } else if (x <= 260 && isLeft) {
    if (!execKeys.has("right")) {
      console.log("왼쪽끝 오른쪽으로 턴");
      isLeft = false;
      port.write("keyUp leftarrow\n");
      execKeys.delete("left");
      setTimeout(() => {
        execKeys.add("right");
        port.write("keyDown rightarrow\n");
      }, 500);
    }
  } else if (x >= 2280 && !isLeft) {
    if (!execKeys.has("left")) {
      console.log("오른쪽끝 왼쪽으로 턴");
      isLeft = true;
      port.write("keyUp rightarrow\n");
      execKeys.delete("right");
      setTimeout(() => {
        execKeys.add("left");
        port.write("keyDown leftarrow\n");
      }, 500);
    }
  }

  if (!execKeys.has("x") && !execKeys.has("leftshift")) {
    execKeys.add("leftshift");
    port.write("keyDown leftshift\n");
    port.write("keyUp leftshift\n");
    setTimeout(() => {
      execKeys.delete("leftshift");
    }, 1300);
  }

  res.send("ok");
});

app.get("/action", (req, res) => {
  const { px, side } = req.query;

  if (!execing) {
    firstExec = false;
    port.write("keyUp leftarrow\n");
    port.write("keyUp rightarrow\n");
    port.write("keyUp leftshift\n");
    port.write("keyUp x\n");
    port.write("keyUp leftctrl\n");
    port.write("keyUp pagedown\n");
    port.write("keyUp pageup\n");
    port.write("keyUp end\n");
    execKeys.clear();
    return res.send("ok");
  }

  if (px && px < 550 && !execKeys.has("x")) {
    console.log("레이를 사용하라");
    port.write("keyDown x\n");
    execKeys.add("x");
    setTimeout(() => {
      port.write("keyUp x\n");
      console.log("힐 사용");
      setTimeout(() => {
        port.write("keyDown leftctrl\n");
        port.write("keyUp leftctrl\n");
        setTimeout(() => {
          execKeys.delete("x");
        }, 1000);
      }, 1000);
    }, 2000);
  }
  return res.send("ok");
});

app.get("/notfound", (req, res) => {
  console.log("notfound.");
  // setTimeout(() => {
  //   plaing = false;
  // }, 22000);
  res.send("ok");
});
app.get("/detect", (req, res) => {
  console.log("detect.");
  // setTimeout(() => {
  //   plaing = false;
  // }, 22000);
  res.send("ok");
});

app.listen(8083, () => {
  console.log("서버 실행 중");
});

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
      console.log("[F] I 서버에 연결됨");
      socket.emit("register", "f");
    });

    socket.on("buff", () => {
      execing = false;
      port.write("keyDown leftctrl\n");
      port.write("keyUp leftctrl\n");
      setTimeout(() => {
        // - 심
        port.write("keyDown pagedown\n");
        port.write("keyUp pagedown\n");
        setTimeout(() => {
          // - 블
          port.write("keyDown pageup\n");
          port.write("keyUp pageup\n");
          setTimeout(() => {
            // - 인빈
            port.write("keyDown end\n");
            port.write("keyUp end\n");
            setTimeout(() => {
              // - 초기화
              execing = true;
            }, 1000);
          }, 1500);
        }, 2000);
      }, 1000);
    });

    socket.on("exit", () => {
      execing = false;
    });

    socket.on("disconnect", () => {
      console.log("소켓 서버 연결 끊김");
    });
  } catch (err) {
    console.error("에러 발생:", err.message);
  }
}

main();
/* 

if (!buffExecing) {
    if (lastExecSymbol + 120000 < Date.now()) {
      buffExecing = true;
      console.log("심볼 사용");
      port.write("keyDown pagedown\n");
      port.write("keyUp pagedown\n");
      lastExecSymbol = Date.now();
      setTimeout(() => {
        port.write("keyDown pageup\n");
        port.write("keyUp pageup\n");
        setTimeout(() => {
          port.write("keyDown end\n");
          port.write("keyUp end\n");
          setTimeout(() => {
            buffExecing = false;
          }, 1000);
        }, 1000);
      }, 1200);
    }
  }
*/
