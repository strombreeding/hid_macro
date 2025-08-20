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
let fourStepDone = false;
let lastStepDone = false;
let startTime = 0;
let dangerMonster = false;
let isSafeArea = false;
let execlay = false;
let actioning = false;

const direct = {
  x: 0,
  y: 0,
  side: "right",
};

function stopExec() {
  firstStepDone = false;
  secondStepDone = false;
  thirdStepDone = false;
  fiveStepDone = false;
  lastStepDone = false;
  execKeys.forEach((key) => {
    keyUpSet(key);
  });
  execKeys.clear();
}

function keyDownSet(key) {
  if (!execKeys.has(key)) {
    port.write(`keyDown ${key}\n`);
    execKeys.add(key);
  }
}

function keyUpSet(key) {
  if (execKeys.has(key)) {
    port.write(`keyUp ${key}\n`);
    execKeys.delete(key);
  }
}

async function moveToUpperStep() {
  if (execlay) {
    await sleep(500);
    console.log("레이끝난 후 이동");
    return await moveToUpperStep();
  }
  actioning = true;
  await sleep(300);
  console.log("위로가기");
  keyDownSet("leftshift");
  keyDownSet("uparrow");
  keyUpSet("uparrow");
  keyUpSet("leftshift");
  actioning = false;
  await sleep(500);
  return true;
}

async function nearMonsterAndLay() {
  if (dangerMonster && !execlay && !actioning) {
    execlay = true;
    keyDownSet("x");
    await sleep(100);
    keyUpSet("x");
    setTimeout(() => {
      execlay = false;
    }, 1200);
    return;
  }
}

// 사다리 타는 함수 실행. 근데 함수 안에서는 execlay가 true면 300ms이후 다시 함수를 재싫애함
async function upperLoader() {
  console.log("upperLoader 실행요청 레이사용여부 =", execlay);
  if (execlay) {
    await sleep(500);
    console.log("레이끝난 후 이동");
    return await upperLoader();
  }
  actioning = true;

  keyDownSet("rightarrow");
  keyDownSet("uparrow");

  await sleep(500);

  keyDownSet("leftalt");
  keyUpSet("leftalt");
  keyUpSet("rightarrow");
  actioning = false;
  return;
}

// 사다리 한번 떨구고 좌측 이동
async function lowerLoader() {
  if (execlay) {
    await sleep(500);
    console.log("레이끝난 후 이동");
    return await lowerLoader();
  }
  actioning = true;
  keyUpSet("uparrow");
  keyDownSet("leftarrow");
  keyDownSet("leftalt");
  keyUpSet("leftalt");
  actioning = false;
  return;
}

let isLoadderOn = false;
let secondStep = false;
let timeoutLoop = null;
let stepEcec = false;
const execAction = async () => {
  if (!execing) {
    return (actioning = false);
  }
  clearTimeout(timeoutLoop);
  actioning = true;
  console.log(direct.x, direct.side, dangerMonster);

  // - 왼쪽으로 이동
  if (direct.x > 450 && !firstStepDone) {
    firstStepDone = true;
    console.log("왼쪽으로 이동하자");
    keyDownSet("leftshift");
    await sleep(50);
    keyDownSet("leftarrow");
    timeoutLoop = setTimeout(async () => await execAction(), 500);
    return;
  }

  // - 위로 이동
  if (direct.x < 450 && !secondStepDone) {
    secondStepDone = true;
    keyUpSet("leftarrow");
    keyUpSet("leftshift");
    await moveToUpperStep();
    timeoutLoop = setTimeout(async () => await execAction(), 500);
    return;
  }

  // - back이 보일때까지 정해진좌표로 이동 및 공격, 및 점프
  if (!thirdStepDone && direct.side === "back") {
    console.log("사다리 메달리기 성공");
    thirdStepDone = true;
    timeoutLoop = setTimeout(async () => await execAction(), 500);
    return;
  } else if (
    secondStepDone &&
    direct.side !== "back" &&
    !thirdStepDone &&
    !stepEcec
  ) {
    stepEcec = true;
    if (direct.x < 790) {
      if (dangerMonster) {
        keyDownSet("x");
        keyUpSet("x");
        await sleep(1200);
        stepEcec = false;
        timeoutLoop = setTimeout(async () => await execAction(), 500);
        return;
      }
      keyUpSet("leftarrow");
      keyDownSet("rightarrow");
      await sleep(650 - direct.x + 30);
      console.log("왼", 650 - direct.x, stepEcec);
      keyDownSet("leftalt");
      setTimeout(() => {
        keyUpSet("leftalt");
      }, 10);
      keyUpSet("rightarrow");
      keyDownSet("uparrow");
      setTimeout(() => {
        keyUpSet("uparrow");
      }, 600);
    } else if (direct.x > 790) {
      if (dangerMonster) {
        keyDownSet("x");
        keyUpSet("x");
        await sleep(1200);
        stepEcec = false;
        timeoutLoop = setTimeout(async () => await execAction(), 500);
        return;
      }
      keyUpSet("rightarrow");
      keyDownSet("leftarrow");
      await sleep(direct.x - 880);
      console.log("오", direct.x - 880);
      keyDownSet("leftalt");
      setTimeout(() => {
        keyUpSet("leftalt");
      }, 10);
      keyUpSet("leftalt");
      keyUpSet("leftarrow");
      keyDownSet("uparrow");
      setTimeout(() => {
        keyUpSet("uparrow");
      }, 850);
    }
    stepEcec = false;
    timeoutLoop = setTimeout(async () => await execAction(), 500);
    return;
  }

  // - 왼쪽으로 한번 떨어지기
  if (thirdStepDone && !fourStepDone) {
    console.log("왼쪽 한번 떨어지기");
    keyDownSet("leftarrow");
    keyDownSet("leftalt");
    keyUpSet("leftalt");
    await sleep(1000);
    keyUpSet("leftarrow");
    fourStepDone = true;
    thirdStepDone = false;
    timeoutLoop = setTimeout(async () => await execAction(), 500);
    return;
  }

  // - x가 오른쪽끝까지 닿을때까지 우측+위측+z키 누르기, 몬스터 발견시 x키 누르기
  if (
    firstStepDone &&
    secondStepDone &&
    thirdStepDone &&
    fourStepDone &&
    !fiveStepDone
  ) {
    console.log("오른쪽 이동");
    keyDownSet("uparrow");
    keyDownSet("rightarrow");
    // keyUpSet("uparrow");
    fiveStepDone = true;
    timeoutLoop = setTimeout(async () => await execAction(), 500);
    return;
  }

  if (dangerMonster) {
    console.log("몹발견, 공격시도");
    await sleep(50);
    keyDownSet("x");
    keyUpSet("x");
    timeoutLoop = setTimeout(async () => await execAction(), 1000);
    return;
  }

  // - 밑점하기
  if (fiveStepDone && !lastStepDone && direct.x > 2150) {
    console.log("밑점하기");
    keyUpSet("uparrow");
    keyUpSet("z");
    keyUpSet("rightarrow");
    await sleep(1000);
    keyDownSet("downarrow");
    await sleep(500);
    keyDownSet("leftalt");
    keyUpSet("leftalt");
    await sleep(300);
    keyUpSet("downarrow");
    await sleep(100);
    lastStepDone = true;
    timeoutLoop = setTimeout(async () => await execAction(), 500);
    return;
  }

  if (
    firstStepDone &&
    secondStepDone &&
    thirdStepDone &&
    fourStepDone &&
    fiveStepDone &&
    lastStepDone
  ) {
    firstStepDone = false;
    secondStepDone = false;
    thirdStepDone = false;
    fourStepDone = false;
    fiveStepDone = false;
    lastStepDone = false;
    buffExecing = false;
    actioning = false;
    execKeys.forEach((key) => port.write(`keyUp ${key}`));
    execKeys.clear();
    return;
  } else {
    timeoutLoop = setTimeout(async () => await execAction(), 500);
    return;
  }
};

app.get("/xy", async (req, res) => {
  const { x, y, px, side } = req.query;
  direct.x = x;
  direct.y = y;
  direct.side = side;

  if (!execing) {
    stopExec();
    return res.send("ok");
  }

  if (execlay || actioning) {
    return res.send("ok");
  }

  // if (dangerMonster) {
  //   await nearMonsterAndLay();
  //   return res.send("ok");
  // }
  if (buffExecing) {
    // getMove = true;
    await execAction();

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
  } else {
    console.log(px, "몹없음");
    dangerMonster = false;
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
      // // - 펫먹이
      // if (buffCnt > 3) {
      //   await sleep(300);
      //   keyDownSet("d");
      //   await sleep(50);
      //   keyUpSet("d");
      //   buffCnt = 0;
      // }
      // await sleep(500);
      // keyDownSet("leftctrl");
      // keyUpSet("leftctrl");
      // await sleep(800);
      // // - 심
      // keyDownSet("pagedown");
      // keyUpSet("pagedown");
      // await sleep(2000);
      // // - 블
      // keyDownSet("pageup");
      // keyUpSet("pageup");
      // await sleep(2200);
      // keyDownSet("leftctrl");
      // keyUpSet("leftctrl");
      // await sleep(500);
      execing = true;
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

let lastExecHeal = Date.now();
async function moveToSafeArea(x) {
  // - 1540 보다 작으면 오른쪽으로 좀 와야함
  /* 
  - 우측발판 좌 : 최대 1560
  - 우측발판 우 : 최대 1530px
  - 좌측발판 좌 : 최소 1344
  - 좌측발판 우 : 최소 1374px
  
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

  if (x > 1560 || 1344 > x) {
    isSafeArea = false;
  }
  if (x > 1500) {
    stayOn = "right";
  } else {
    stayOn = "left";
  }

  if (dangerMonster && !execlay) {
    await nearMonsterAndLay();
    return;
  }

  if (isSafeArea && lastExecHeal + Math.random() * 1000 + 2000 < Date.now()) {
    keyDownSet("leftctrl");
    await sleep(200);
    keyUpSet("leftctrl");
    lastExecHeal = Date.now();
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
    if (x > 1560) {
      const range = x < 1800 ? 75 : 600;
      // const range = x - 1560 < 50 ? 75 : 150;
      safeMoving = true;
      // if (x > 1999) {
      //   keyDownSet("leftshift");
      // }
      keyDownSet("leftarrow");
      keyUpSet("leftshift");
      await sleep(range);
      keyUpSet("leftarrow");
      console.log("무빙 끝");
      safeMoving = false;
      isSafeArea = false;
      console.log("빨리 안전지대로 이동하세요, 몬스터가 없을때 이동하세요");
    } else {
      safeMoving = false;
      isSafeArea = true;
      keyUpSet("leftarrow");

      console.log("현재 안전지대 입니다.");
    }
  } else if (stayOn === "left") {
    if (x < 1344) {
      const range = 1344 - x < 50 ? 75 : 600;
      safeMoving = true;
      // if (x < 800) {
      //   keyDownSet("leftshift");
      // }
      keyDownSet("rightarrow");
      keyUpSet("leftshift");
      await sleep(range);
      keyUpSet("rightarrow");
      console.log("무빙 끝");
      safeMoving = false;
      isSafeArea = false;
      console.log("빨리 안전지대로 이동하세요, 몬스터가 없을때 이동하세요");
    } else {
      safeMoving = false;
      isSafeArea = true;

      console.log("현재 안전지대 입니다.");
    }
  }
}
