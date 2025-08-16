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
let lastStepDone = false;
let startTime = 0;
let dangerMonster = false;
let isSafeArea = false;

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
    // console.log("keyDown", key);
    console.log(execKeys.entries());
  }
}

function keyUpSet(key) {
  if (execKeys.has(key)) {
    port.write(`keyUp ${key}\n`);
    execKeys.delete(key);
    // console.log("keyUp", key);
    console.log(execKeys.entries());
  }
}
app.get("/xy", async (req, res) => {
  const { x, y, px, side } = req.query;

  if (!execing) {
    console.log("동작그만");
    stopExec();
    return res.send("ok");
  }

  if (buffExecing) {
    // getMove = true;

    // console.log(x, y);
    if (x > 390 && y > 1000 && !firstStepDone) {
      console.log("왼쪽으로 이동하자");
      if (startTime === 0) {
        startTime = Date.now();
      }
      keyDownSet("leftshift");
      await sleep(50);
      keyDownSet("leftarrow");
      firstStepDone = true;
    } else if (x < 390) {
      if (!secondStepDone) {
        await sleep(300);
        console.log("위로가기");

        keyUpSet("leftarrow");
        await sleep(100);
        keyDownSet("uparrow");
        await sleep(50);
        keyUpSet("uparrow");
        await sleep(50);

        secondStepDone = true;
      } else if (!thirdStepDone) {
        thirdStepDone = true;
        console.log("오른쪽으로 이동하자");
        keyUpSet("leftshift");
        await sleep(350);
        keyDownSet("x");
        await sleep(600);
        keyUpSet("x");
        await sleep(2200); // 확실하게 기다려보기
        keyDownSet("leftshift");
        await sleep(300);
        keyDownSet("rightarrow");
        await sleep(50);
        keyUpSet("rightarrow");
        await sleep(50);
        keyUpSet("leftshift");
        await sleep(300);
        keyDownSet("leftarrow");
        await sleep(120);
        keyDownSet("leftalt");
        keyUpSet("leftalt");
        keyUpSet("leftarrow");
        keyDownSet("uparrow");
        //@ 고의적으로 한번 떨어트려
        await sleep(600);
        keyUpSet("uparrow");
        keyDownSet("leftarrow");
        keyDownSet("leftalt");
        keyUpSet("leftalt");
        //@ 1초후 다시 반복
        await sleep(350);
        keyDownSet("x");
        await sleep(600);
        keyUpSet("x");
        await sleep(2200);
        keyUpSet("leftarrow");
        await sleep(50);
        keyDownSet("leftshift");
        //@ 오른쪽으로 다시 텔포1, 사다리타기 이후 끝
        await sleep(300);
        console.log("오른쪽으로 이동하자222", execKeys.entries());
        keyDownSet("rightarrow");
        await sleep(50);
        keyUpSet("rightarrow");
        keyUpSet("leftshift");
        await sleep(200);
        keyDownSet("leftarrow");
        await sleep(100);
        keyUpSet("leftarrow");
        await sleep(50);
        keyDownSet("leftalt");
        keyUpSet("leftalt");
        await sleep(50);
        keyDownSet("uparrow");
        await sleep(50);
        // keyDownSet("z");
        // //@
        await sleep(50);
        keyDownSet("rightarrow");
        await sleep(50);
        keyDownSet("z");
        await sleep(1600);
        keyUpSet("uparrow");
        console.log(execKeys.has("uparrow"));
      }
    } else if (x > 2100 && y > 970 && y < 1030 && !lastStepDone) {
      lastStepDone = true;
      console.log("마지막 단계");
      keyUpSet("rightarrow");
      keyUpSet("z");
      await sleep(50);
      keyDownSet("downarrow");
      await sleep(1000);
      keyDownSet("leftalt");
      keyUpSet("leftalt");
      await sleep(50);
      keyUpSet("downarrow");
      await sleep(100);
      buffExecing = false;
      firstStepDone = false;
      secondStepDone = false;
      thirdStepDone = false;
      lastStepDone = false;
      console.log("다 먹었다!!");
      console.log("소요시간", Math.floor((Date.now() - startTime) / 1000), "s");
      startTime = 0;
    }
    // 1100 정도에 힐이 닿는다

    return res.send("ok");
  }

  // - 일반적으로 자리를 유지하는 로직
  moveToSafeArea(x);

  res.send("ok");
});

app.get("/action", async (req, res) => {
  const { px, side } = req.query;
  if (px && px < 330) {
    console.log(px, "몹");
    dangerMonster = true;
  }
  if (!execing || buffExecing || !isSafeArea) {
    return res.send("ok");
  }

  if (px && px < 350 && !execKeys.has("x")) {
    await sleep(300);
    keyDownSet("x");
    await sleep(2000);
    keyUpSet("x");
  } else if (px && !execKeys.has("leftctrl")) {
    keyDownSet("leftctrl");
    await sleep(500);
    port.write("keyUp leftctrl\n");
    await sleep(3000);
    keyUpSet("leftctrl");
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

    socket.on("buff", async () => {
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
            port.write("keyDown leftctrl\n");
            port.write("keyUp leftctrl\n");
            setTimeout(() => {
              execing = true;
              console.log("버프 끝");
            }, 500);
          }, 3000);
        }, 2000);
      }, 1000);
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
  if (x > 1450) {
    stayOn = "right";
  } else if (x < 1370) {
    stayOn = "left";
  }

  if (buffExecing) {
    console.log("버프 실행중입니다.");
    setTimeout(() => {
      buffExecing = false;
    }, 1000);
    return res.send("ok");
  }
  console.log(stayOn);
  // 안전지대 판단
  if (stayOn === "right" && !safeMoving) {
    if (x > 1540) {
      const range = x - 1540 < 150 ? 75 : 450;
      safeMoving = true;
      if (x > 1999) {
        port.write("keyDown leftshift\n");
      }
      port.write("keyDown leftarrow\n");
      port.write("keyUp leftshift\n");
      setTimeout(() => {
        port.write("keyUp leftarrow\n");
        console.log("무빙 끝");
        safeMoving = false;
        isSafeArea = false;
      }, range); // 100
      console.log("빨리 안전지대로 이동하세요, 몬스터가 없을때 이동하세요");
    } else {
      safeMoving = false;
      isSafeArea = true;
      port.write("keyUp leftarrow\n");

      console.log("현재 안전지대 입니다.");
    }
  } else if (stayOn === "left") {
    if (x < 1300) {
      const range = 1300 - x < 200 ? 50 : 200;
      safeMoving = true;
      if (x < 800) {
        port.write("keyDown leftshift\n");
      }
      port.write("keyDown rightarrow\n");
      port.write("keyUp leftshift\n");
      setTimeout(() => {
        port.write("keyUp rightarrow\n");
        console.log("무빙 끝");
        safeMoving = false;
        isSafeArea = false;
      }, range);
      console.log("빨리 안전지대로 이동하세요, 몬스터가 없을때 이동하세요");
    } else {
      safeMoving = false;
      isSafeArea = true;

      console.log("현재 안전지대 입니다.");
    }
  }
}
