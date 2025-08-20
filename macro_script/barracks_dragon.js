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

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

app.use(express.json());

let execing = false;

const execKeys = new Set();

let buffCnt = 0;
let stayOn = "";
let buffExecing = true;
let safeMoving = false;
let firstStepDone = false;
let secondStepDone = false;
let thirdStepDone = false;
let isSafeArea = false;
let lastStepDone = false;
let canEatDrink = false;
let timer = null;

function stopExec() {
  port.write("keyUp leftarrow\n");
  port.write("keyUp uparrow\n");
  port.write("keyUp downarrow\n");
  port.write("keyUp rightarrow\n");
  port.write("keyUp leftshift\n");
  port.write("keyUp z\n");
  port.write("keyUp leftctrl\n");
  firstStepDone = false;
  secondStepDone = false;
  thirdStepDone = false;
  lastStepDone = false;
  execKeys.clear();
}

function keyDownSet(key) {
  if (!execKeys.has(key)) {
    port.write(`keyDown ${key}\n`);
    execKeys.add(key);
    console.log("keyDown", key);
  }
}

function keyUpSet(key) {
  if (execKeys.has(key)) {
    port.write(`keyUp ${key}\n`);
    execKeys.delete(key);
  }
}
app.get("/xy", async (req, res) => {
  const { x, y, px, side } = req.query;
  console.log(x, y);
  if (!execing) {
    console.log("동작그만");
    stopExec();
    return res.send("ok");
  }

  if (buffExecing) {
    // getMove = true;

    return res.send("ok");
  }

  // - 일반적으로 자리를 유지하는 로직
  moveToSafeArea(x);

  res.send("ok");
});

app.get("/action", async (req, res) => {
  const { px, side } = req.query;

  if (!execing || buffExecing || !isSafeArea) {
    return res.send("ok");
  }

  if (px && !execKeys.has("leftshift")) {
    await sleep(350);
    if (canEatDrink) {
      keyDownSet("t");
      keyUpSet("t");
      await sleep(50);
      keyDownSet("t");
      keyUpSet("t");
    }
    keyDownSet("leftshift");
    keyUpSet("leftshift");
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
      console.log("[D] I 서버에 연결됨");
      socket.emit("register", "d");
    });

    socket.on("buff", async () => {
      canEatDrink = true;
      ++buffCnt;
      buffExecing = true;
      execing = false;
      // - 펫먹이
      if (buffCnt > 3) {
        await sleep(300);
        keyDownSet("d");
        await sleep(50);
        keyUpSet("d");
        buffCnt = 0;
      }
      port.write("keyDown space\n");
      await sleep(1000);
      port.write("keyUp space\n");
      await sleep(1000);
      execing = true;
      buffExecing = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        canEatDrink = false;
      }, 20000);
    });

    socket.on("exit", () => {
      console.log("종료");
      stopExec();
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

function moveToSafeArea(x) {
  // - 1540 보다 작으면 오른쪽으로 좀 와야함
  /* 
  - 우측발판 좌 : 최대 1540px
  - 우측발판 우 : 최대 1550px
  - 우측발판 최대 : 1470px
  - 좌측발판 좌 : 최소 1280px
  - 좌측발판 우 : 최소 1300px
  - 좌측발판 최대 : 1370px
  
  - 서 있는곳 판단
  - 우측발판일 경우 x좌표가 1450보다 크면 우측발판임
  - 좌측발판일 경우 x좌표가 1370보다 작으면 좌측발판임

  - 버프 시작하고 계속해서 나의 위치가 어디인지 판단. 
  - 예를들어 심블 주고 내 위치가 1530 이고, 위너가 left라면 지금 우측발판 안전지대인거임
  - 근데 내 위치가 1560이라면 left딸깍해서 1540 밑으로 이동해야함
  - 반대로도 내 위치가 좌측인데 1280보다 작으면 right딸깍해서 1280보단 커지고 13
  - 수식으로 적어보자면 
  - if(내가 우측발판에 있을 경우)
  - if (x > 1550 ) { 왼쪽으로 이동}
  - if (x < 1500 ){ 오른쪽으로 이동함}
  */
  // 현재 어디 발판쪽에 있는지
  if (x > 1600) {
    stayOn = "right";
  } else if (x < 1510) {
    stayOn = "left";
  } else {
    //! 비상 케이스
    stayOn = "center";
  }

  // 안전지대 판단
  if (stayOn === "right" && !safeMoving) {
    if (x > 1660) {
      const range = x - 1660 < 75 ? 50 : 50;
      safeMoving = true;
      port.write("keyDown leftarrow\n");
      setTimeout(() => {
        port.write("keyUp leftarrow\n");
        console.log("무빙 끝");
        safeMoving = false;
      }, range); // 100
      isSafeArea = false;
      console.log("빨리 안전지대로 이동하세요, 몬스터가 없을때 이동하세요");
    } else {
      safeMoving = false;
      isSafeArea = true;
      port.write("keyUp leftarrow\n");

      console.log("현재 안전지대 입니다.");
    }
  } else if (stayOn === "left") {
    if (x < 1429) {
      const range = 1429 - x < 75 ? 50 : 50;
      safeMoving = true;
      port.write("keyDown rightarrow\n");
      setTimeout(() => {
        port.write("keyUp rightarrow\n");
        console.log("무빙 끝");
        safeMoving = false;
      }, range);
      isSafeArea = false;
      console.log("빨리 안전지대로 이동하세요, 몬스터가 없을때 이동하세요");
    } else {
      safeMoving = false;
      isSafeArea = true;

      console.log("현재 안전지대 입니다.");
    }
  }
}
