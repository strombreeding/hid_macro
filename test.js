const express = require("express");
const player = require("play-sound")();
const fs = require("fs");

const app = express();

let plaing = false;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/", (req, res) => {
  console.log(req.body);

  const { app_feature, screens, features, figma_prompt } = req.body; // input data

  function formatScreenFeatures(features) {
    return features
      .map((feature) => {
        return (
          `${feature.ScreenName} = ${feature.ScreenName}\n` +
          `- Layout : ${feature.Layout}\n` +
          `- Key UI Elements : ${feature["Key UI Elements"]}\n` +
          `- Visual Style Suggestions : ${feature["Visual Style Suggestions"]}`
        );
      })
      .join("\n\n"); // 각 항목 사이에 빈 줄 추가
  }

  const output = formatScreenFeatures(figma_prompt);

  function splitPromptByScreen(input) {
    const blocks = input.split(/\n(?=\w.+? = )/); // "ScreenName = ScreenName" 패턴 기준으로 분리

    return blocks.map((block) => {
      const firstLine = block.split("\n")[0];
      const screenName = firstLine.split("=")[0].trim(); // 예: "Onboarding Screen"

      return {
        screenName,
        prompt: block.trim(),
      };
    });
  }

  const json = JSON.stringify({
    app_feature,
    screens,
    features,
    figma_prompt: splitPromptByScreen(output),
  });

  fs.writeFileSync("./test.json", json);
  res.send("ok");
});

app.get("/check", (req, res) => {
  if (plaing) {
    res.send("already playing");
    return;
  }
  // plaing = true;
  player.play("./alaram.mp3", (err) => {
    if (err) {
      console.log("오디오 재생 중 오류 발생:", err);
    }
  });
  // setTimeout(() => {
  //   plaing = false;
  // }, 22000);
  res.send("ok");
});

app.listen(8080, () => {
  console.log("서버 실행 중");
});
