phina.globalize();
(function () {
  "use strict";
  var G = GoLogic,
    S = 13,
    W = 720,
    H = 1180,
    L = 54,
    T = 42,
    BP = 612,
    C = BP / (S - 1),
    MY = 740,
    BY = 850;
  var TARGET = { x: 1, y: 11 },
    GOAL = { x: 10, y: 10 };
  var INIT = [
    { x: 0, y: 10, c: G.BLACK },
    { x: 0, y: 11, c: G.BLACK },
    { x: 1, y: 11, c: G.WHITE },
    { x: 1, y: 12, c: G.BLACK },
    { x: 2, y: 11, c: G.BLACK },
  ];
  function pos(x, y) {
    return { x: L + x * C, y: T + y * C };
  }
  function newBoard() {
    var b = new G.GoBoard(S);
    INIT.forEach((s) => b.set(s.x, s.y, s.c));
    return b;
  }
  function btn(sc, x, y, w, text, color, fn) {
    var r = RectangleShape({
      width: w,
      height: 70,
      cornerRadius: 16,
      fill: color,
      stroke: "#000",
      strokeWidth: 12,
    })
      .setPosition(x, y)
      .addChildTo(sc)
      .setInteractive(true);
    var buttonLabel = Label({
      text: text,
      fontSize: 27,
      fill: "#fff",
      fontWeight: "bold",
    }).addChildTo(r);
    r.buttonLabel = buttonLabel;
    r.onpointstart = fn;
    return r;
  }
  function clonePoints(a) {
    return (a || []).map((p) => ({ x: p.x, y: p.y }));
  }
  phina.define("TitleScene", {
    superClass: "DisplayScene",
    init: function () {
      this.superInit({ width: W, height: H });
      this.backgroundColor = "#159447";

      // タイトル画像
      var titleLogo = Sprite("titleLogo")
        .addChildTo(this)
        .setPosition(W / 2, 400);

      var targetWidth = 600;
      var scale = targetWidth / titleLogo.width;
      titleLogo.setScale(scale);

      Sprite("neko1")
        .addChildTo(this)
        .setPosition(W / 2, 630);

      btn(this, W / 2, 755, 330, "あそぶ", "#ef6c00", () => this.exit("main"));
      Label({
        text: "シチョウで、白石をゴールにみちびこう！",
        fontSize: 28,
        fill: "#fff",
        lineHeight: 1.5,
      })
        .setPosition(W / 2, 900)
        .addChildTo(this);
    },
  });
  phina.define("MainScene", {
    superClass: "DisplayScene",
    init: function () {
      this.superInit({ width: W, height: H });
      this.backgroundColor = "#159447";
      this.board = newBoard();
      this.target = { x: TARGET.x, y: TARGET.y };
      this.turn = "white";
      this.running = false;
      this.replaying = false;
      this.replayPaused = false;
      this.canStart = true;
      this.editBoard = null;
      this.objects = [];
      this.frames = [];
      this.branchMarkers = [];
      this.captureMoves = [];
      this.captureStones = [];
      this.last = null;
      this.catFrame = 1;
      this.tutorialStep = 1;
      this.tutorialActive = true;
      this.tutorialObjects = [];
      this.replayNavVisible = false;
      this.replayCurrentIndex = -1;
      this.playbackInterval = 200;
      this.simulationResult = null;
      this.goalReached = false;
      this.piAnimating = false;
      this.stoneSprites = [];
      this.displayedCells = Array(S * S).fill(-1);
      this.displayedLastKey = "";
      this.moveEffectKey = "";
      this.storageKey = "pitagora-shicho-board-v1";
      this.workMenuOpen = false;
      this.workMenuObjects = [];
      this.base = DisplayElement().addChildTo(this);
      this.drawBase();
      this.createBoardSprites();
      this.msg = Label({
        text: "",
        fontSize: 30,
        fill: "#fff",
        lineHeight: 1.35,
      })
        .setPosition(380, MY)
        .addChildTo(this);
      this.catSprite = Sprite("neko1").addChildTo(this).setPosition(82, MY);
      // 4つの操作を横一列に配置。右端の細い「⋮」は作品メニュー。
      this.startButton = btn(this, 115, BY, 180, "スタート", "#ef6c00", () => this.primaryAction());
      this.resetButton = btn(this, 310, BY, 160, "手直し", "#1976d2", () => this.editAgain());
      this.replayButton = btn(this, 485, BY, 150, "全消去", "#607d8b", () => this.reset());
      this.workButton = btn(this, 655, BY, 70, "⋮", "#4A4A44", () => this.toggleWorkMenu());
      if (this.workButton.buttonLabel) this.workButton.buttonLabel.fontSize = 34;
      this.prevReplayButton = btn(this, 255, BY + 92, 84, "◀", "#4A4A44", () =>
        this.stepReplay(-1),
      );
      this.nextReplayButton = btn(this, 465, BY + 92, 84, "▶", "#4A4A44", () =>
        this.stepReplay(1),
      );
      this.replayCounter = Label({
        text: "0 / 0",
        fontSize: 24,
        fill: "#fff",
        fontWeight: "bold",
      })
        .setPosition(360, BY + 92)
        .addChildTo(this);
      this.slowSpeedButton = btn(this, 205, BY + 184, 130, "ゆっくり", "#607d8b", () => this.setPlaybackSpeed(400));
      this.normalSpeedButton = btn(this, 360, BY + 184, 130, "ふつう", "#607d8b", () => this.setPlaybackSpeed(200));
      this.fastSpeedButton = btn(this, 515, BY + 184, 130, "はやい", "#607d8b", () => this.setPlaybackSpeed(100));
      this.setReplayNavVisible(false);
      this.updateSpeedButtons();
      this.updateButtons();
      this.onpointstart = (e) => {
        if (this.tutorialActive) {
          this.nextTutorial();
          return;
        }
        this.tap(e.pointer.x, e.pointer.y);
      };
      this.render();
      this.showTutorialStep();
    },
    toggleWorkMenu: function () {
      if (this.tutorialActive || this.running || this.replaying) return;
      if (this.workMenuOpen) this.closeWorkMenu();
      else this.openWorkMenu();
    },
    openWorkMenu: function () {
      this.closeWorkMenu();
      this.workMenuOpen = true;

      var panel = RectangleShape({
        width: 340, height: 290, cornerRadius: 18,
        fill: "rgba(20,35,45,0.96)", stroke: "#fff", strokeWidth: 4,
      }).setPosition(W / 2, 850).addChildTo(this);
      this.workMenuObjects.push(panel);

      var saveButton = btn(this, W / 2, 770, 280, "この配置を保存", "#ef6c00", () => {
        this.saveBoardToLocalStorage();
        this.closeWorkMenu();
      });
      var loadButton = btn(this, W / 2, 850, 280, "保存した配置を読込", "#1976d2", () => {
        this.loadBoardFromLocalStorage();
        this.closeWorkMenu();
      });
      var closeButton = btn(this, W / 2, 930, 280, "閉じる", "#607d8b", () =>
        this.closeWorkMenu(),
      );
      this.workMenuObjects.push(saveButton, loadButton, closeButton);
    },
    closeWorkMenu: function () {
      this.workMenuObjects.forEach((o) => o.remove());
      this.workMenuObjects = [];
      this.workMenuOpen = false;
    },
    serializeBoardForStorage: function () {
      // INIT/Gは復元時に正規化するので、現在の編集盤面をそのまま保存してよい。
      return {
        version: 1,
        size: S,
        cells: this.board.cells.slice(),
        savedAt: new Date().toISOString(),
      };
    },
    saveBoardToLocalStorage: function () {
      if (!this.canStart || this.running || this.replaying) return;
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.serializeBoardForStorage()));
        this.msg.text = "この配置を保存したよ";
      } catch (e) {
        console.error("盤面の保存に失敗", e);
        this.msg.text = "保存できなかった…";
      }
    },
    loadBoardFromLocalStorage: function () {
      try {
        var raw = localStorage.getItem(this.storageKey);
        if (!raw) {
          this.msg.text = "保存した配置がないよ";
          return;
        }
        var data = JSON.parse(raw);
        if (!data || data.version !== 1 || data.size !== S || !Array.isArray(data.cells) || data.cells.length !== S * S)
          throw new Error("保存データの形式が違います");

        var loaded = new G.GoBoard(S, data.cells);
        this.board = loaded;
        // 固定初期石、発火前の空点、Gを現在ルールに合わせて正規化する。
        INIT.forEach((stone) => this.board.set(stone.x, stone.y, stone.c));
        this.board.set(TARGET.x, TARGET.y - 1, G.EMPTY);
        this.board.set(GOAL.x, GOAL.y, G.EMPTY);

        this.invalidateStoneDisplay();
        this.target = { x: TARGET.x, y: TARGET.y };
        this.turn = "white";
        this.running = false;
        this.replaying = false;
        this.replayPaused = false;
        this.canStart = true;
        this.editBoard = null;
        this.frames = [];
        this.simulationResult = null;
        this.goalReached = false;
        this.piAnimating = false;
        this.replayCurrentIndex = -1;
        this.setReplayNavVisible(false);
        this.clearHints();
        this.last = null;
        this.resetCat();
        this.msg.text = "保存した配置を読み込んだよ";
        this.render();
        this.updateButtons();
      } catch (e) {
        console.error("盤面の読込に失敗", e);
        this.msg.text = "読み込めなかった…";
      }
    },
    setReplayNavVisible: function (visible) {
      this.replayNavVisible = visible;
      if (this.prevReplayButton) this.prevReplayButton.visible = visible;
      if (this.nextReplayButton) this.nextReplayButton.visible = visible;
      if (this.replayCounter) this.replayCounter.visible = visible;
      if (this.speedLabel) this.speedLabel.visible = visible;
      if (this.slowSpeedButton) this.slowSpeedButton.visible = visible;
      if (this.normalSpeedButton) this.normalSpeedButton.visible = visible;
      if (this.fastSpeedButton) this.fastSpeedButton.visible = visible;
      if (visible) this.updateSpeedButtons();
    },
    setPlaybackSpeed: function (milliseconds) {
      this.playbackInterval = milliseconds;
      this.updateSpeedButtons();
      if (this.replaying && !this.replayPaused) {
        this.tweener.clear().wait(this.playbackInterval).call(() => this.playFrame());
      }
    },
    updateSpeedButtons: function () {
      [
        { button: this.slowSpeedButton, value: 400 },
        { button: this.normalSpeedButton, value: 200 },
        { button: this.fastSpeedButton, value: 100 },
      ].forEach((item) => {
        if (!item.button) return;
        var selected = this.playbackInterval === item.value;
        item.button.fill = selected ? "#ffd600" : "#607d8b";
        item.button.alpha = selected ? 1 : 0.78;
        if (item.button.buttonLabel) item.button.buttonLabel.fill = selected ? "#000" : "#fff";
      });
    },
    updateReplayCounter: function () {
      if (!this.replayCounter) return;
      var total = this.frames.length;
      var current =
        this.replayCurrentIndex >= 0 ? this.replayCurrentIndex + 1 : 0;
      this.replayCounter.text = current + " / " + total;
      var prevEnabled = this.replayNavVisible && current > 1;
      var nextEnabled = this.replayNavVisible && current < total;
      if (this.prevReplayButton) {
        this.prevReplayButton.fill = prevEnabled ? "#4A4A44" : "#777777";
        this.prevReplayButton.alpha = prevEnabled ? 1 : 0.45;
        this.prevReplayButton.setInteractive(prevEnabled);
      }
      if (this.nextReplayButton) {
        this.nextReplayButton.fill = nextEnabled ? "#4A4A44" : "#777777";
        this.nextReplayButton.alpha = nextEnabled ? 1 : 0.45;
        this.nextReplayButton.setInteractive(nextEnabled);
      }
    },
    showReplayFrame: function (index) {
      if (!this.frames.length) return;
      index = Math.max(0, Math.min(this.frames.length - 1, index));
      var f = this.frames[index];
      var wasGoalReached = this.goalReached;
      // 成功フレームだけpi.pngを表示する。1手戻せば自動的に消える。
      this.goalReached = f.text.indexOf("ゴールだ！") === 0;
      this.replayCurrentIndex = index;
      this.fi = index + 1;
      this.board = new G.GoBoard(S, f.cells);
      this.last = f.last;
      this.branchMarkers = f.branchMarkers || [];
      this.captureMoves = f.captureMoves || [];
      this.captureStones = f.captureStones || [];
      this.msg.text = f.text;
      if (this.goalReached) this.showHappyCat();
      else if (index === this.frames.length - 1)
        this.showSadCat();
      else {
        var n = 0;
        for (var i = 0; i <= index; i++) {
          var t = this.frames[i].text;
          if (t === "白が逃げる" || t === "黒が追う") n++;
        }
        this.catFrame = n % 2 === 0 ? 1 : 2;
        this.setCat(this.catFrame === 1 ? "neko1" : "neko2");
      }
      if (this.goalReached && !wasGoalReached) {
        SoundManager.play('goalSound');
        // ゴールへ入った瞬間は、旗なしの盤面を描いてから旗を立てる。
        this.piAnimating = true;
        this.render();
        this.showPiFlag(true);
        this.showGoalCelebration();
        this.piAnimating = false;
      } else {
        this.render();
      }
      // 自動再生中、新しく石が置かれたフレームだけ着手エフェクト
      if (!this.replayPaused && f.last) {
          var li = f.last.y * S + f.last.x;

          var prevValue =
              index > 0
                  ? this.frames[index - 1].cells[li]
                  : G.EMPTY;

          var nowValue = f.cells[li];

          if (
              prevValue === G.EMPTY &&
              (nowValue === G.BLACK || nowValue === G.WHITE)
          ) {
              var previousWhiteMove =
                  nowValue === G.WHITE
                      ? this.findPreviousWhiteMove(index)
                      : null;
              this.playStoneMoveEffect(
                  f.last.x,
                  f.last.y,
                  previousWhiteMove
              );
          }
      }
      this.updateReplayCounter();
    },
    stepReplay: function (delta) {
      if (!this.frames.length || !this.replayNavVisible) return;
      this.replaying = true;
      this.replayPaused = true;
      this.tweener.clear();
      var base = this.replayCurrentIndex >= 0 ? this.replayCurrentIndex : 0;
      this.showReplayFrame(base + delta);
      if (this.replayCurrentIndex === this.frames.length - 1) {
        // 手動で最終フレームへ到達したら、結果後の状態へ確定する。
        this.replaying = false;
        this.replayPaused = false;
        this.fi = this.frames.length;
      }
      this.updateButtons();
    },
    setCat: function (name) {
      if (this.catSprite) this.catSprite.image = name;
    },
    resetCat: function () {
      this.catFrame = 1;
      this.setCat("neko1");
    },
    toggleCat: function () {
      this.catFrame = this.catFrame === 1 ? 2 : 1;
      this.setCat(this.catFrame === 1 ? "neko1" : "neko2");
    },
    showHappyCat: function () {
      this.setCat("neko3");
    },
    showSadCat: function () {
      this.setCat("neko4");
    },
    clearTutorial: function () {
      this.tutorialObjects.forEach((o) => o.remove());
      this.tutorialObjects = [];
    },
    addTutorial: function (o) {
      this.tutorialObjects.push(o);
      return o;
    },
    addTutorialShade: function (x, y, width, height, alpha) {
      if (width <= 0 || height <= 0) return;
      var shade = RectangleShape({
        width: width,
        height: height,
        fill: "#000",
        stroke: "transparent",
      })
        .setPosition(x, y)
        .addChildTo(this);
      shade.alpha = alpha;
      this.addTutorial(shade);
    },
    addSpotlightCurtains: function (holeX, holeY, holeWidth, holeHeight) {
      var boardLeft = L - 28,
        boardTop = T - 28;
      var boardRight = L + BP + 28,
        boardBottom = T + BP + 28;
      var holeLeft = Math.max(boardLeft, holeX - holeWidth / 2);
      var holeTop = Math.max(boardTop, holeY - holeHeight / 2);
      var holeRight = Math.min(boardRight, holeX + holeWidth / 2);
      var holeBottom = Math.min(boardBottom, holeY + holeHeight / 2);
      var alpha = 0.5;
      this.addTutorialShade(
        (boardLeft + boardRight) / 2,
        (boardTop + holeTop) / 2,
        boardRight - boardLeft,
        holeTop - boardTop,
        alpha,
      );
      this.addTutorialShade(
        (boardLeft + boardRight) / 2,
        (holeBottom + boardBottom) / 2,
        boardRight - boardLeft,
        boardBottom - holeBottom,
        alpha,
      );
      this.addTutorialShade(
        (boardLeft + holeLeft) / 2,
        (holeTop + holeBottom) / 2,
        holeLeft - boardLeft,
        holeBottom - holeTop,
        alpha,
      );
      this.addTutorialShade(
        (holeRight + boardRight) / 2,
        (holeTop + holeBottom) / 2,
        boardRight - holeRight,
        holeBottom - holeTop,
        alpha,
      );
      return {
        width: holeRight - holeLeft,
        height: holeBottom - holeTop,
        centerX: (holeLeft + holeRight) / 2,
        centerY: (holeTop + holeBottom) / 2,
      };
    },
    showTutorialStep: function () {
      this.clearTutorial();
      if (!this.tutorialActive) return;
      var text = "",
        textX = W / 2,
        textY = T + BP / 2,
        hole = null;
      if (this.tutorialStep === 1) {
        var startP = pos(TARGET.x, TARGET.y);
        hole = this.addSpotlightCurtains(
          startP.x - C * 0.45,
          startP.y,
          C * 3.25,
          C * 3.2,
        );
        text = "ここからシチョウが始まって、\n白が逃げます";
      } else if (this.tutorialStep === 2) {
        var goalP = pos(GOAL.x, GOAL.y);
        hole = this.addSpotlightCurtains(goalP.x, goalP.y, C * 2.2, C * 2.2);
        text = "白が「Ｇ」まで来たらゴールです";
      } else {
        text = "好きな場所に石を置いて、\n白石をゴールへみちびこう！\n\nこのゲームの特別ルールとして、\n途中で黒石が取られたらダメです";
      }
      if (hole) {
        var frame =
          this.tutorialStep === 1
            ? RectangleShape({
                width: hole.width,
                height: hole.height,
                cornerRadius: 34,
                fill: "transparent",
                stroke: "#ffd54f",
                strokeWidth: 5,
              })
            : CircleShape({
                radius: Math.min(hole.width, hole.height) / 2,
                fill: "transparent",
                stroke: "#ffd54f",
                strokeWidth: 5,
              });
        this.addTutorial(
          frame.setPosition(hole.centerX, hole.centerY).addChildTo(this),
        );
      }
      var uiTop = T + BP + 28;
      // this.addTutorialShade(W / 2, (uiTop + H) / 2, W, H - uiTop, 0.76);
      var shade = RectangleShape({
        width: W,
        height: H - uiTop,
        fill: "#159447",
        stroke: "transparent",
      })
        .setPosition(W / 2, (uiTop + H) / 2)
        .addChildTo(this);
      shade.alpha = 1;
      this.addTutorial(shade);
      this.addTutorial(
        Label({
          text: text,
          fontSize: 34,
          fill: "#fff",
          fontWeight: "bold",
          lineHeight: 1.35,
          stroke: "rgba(0,0,0,0.68)",
          strokeWidth: 6,
          align: "center",
        })
          .setPosition(textX, textY)
          .addChildTo(this),
      );
      this.addTutorial(
        Label({
          text:
            this.tutorialStep < 3
              ? "タップして次へ"
              : "タップしてはじめよう！",
          fontSize: 22,
          fill: "rgba(255,255,255,1)",
          fontWeight: "bold",
        })
          .setPosition(W / 2, H - 450)
          .addChildTo(this),
      );
    },
    nextTutorial: function () {
      if (!this.tutorialActive) return;
      if (this.tutorialStep < 3) {
        this.tutorialStep += 1;
        this.showTutorialStep();
        return;
      }
      this.tutorialActive = false;
      this.clearTutorial();
      this.msg.text =
        "空いてるところをタップすると\n白 → 黒 → 空 で変わるよ";
      this.updateButtons();
    },
    updateButtons: function () {
      if (!this.startButton || !this.resetButton || !this.replayButton) return;

      var editing = !this.tutorialActive && this.canStart && !this.running && !this.replaying;
      var playing = !this.tutorialActive && !this.running && this.replaying && !this.replayPaused;
      var paused = !this.tutorialActive && !this.running && this.replaying && this.replayPaused;
      var result = !this.tutorialActive && !this.running && !this.replaying && !this.canStart && this.frames.length > 0;
      var calculating = !this.tutorialActive && this.running;

      var leftEnabled = editing || playing || paused || result;
      var leftText = "スタート";
      if (playing) leftText = "一時停止";
      else if (paused) leftText = "再開";
      else if (result) leftText = "リプレイ";
      this.startButton.fill = leftEnabled ? "#ef6c00" : "#777777";
      this.startButton.alpha = leftEnabled ? 1 : 0.55;
      this.startButton.setInteractive(leftEnabled);
      if (this.startButton.buttonLabel) this.startButton.buttonLabel.text = leftText;

      var editEnabled = (paused || result) && !!this.editBoard;
      this.resetButton.fill = editEnabled ? "#1976d2" : "#777777";
      this.resetButton.alpha = editEnabled ? 1 : 0.55;
      this.resetButton.setInteractive(editEnabled);
      if (this.resetButton.buttonLabel) this.resetButton.buttonLabel.text = "手直し";

      var clearEnabled = editing || paused || result;
      this.replayButton.fill = clearEnabled ? "#607d8b" : "#777777";
      this.replayButton.alpha = clearEnabled ? 1 : 0.55;
      this.replayButton.setInteractive(clearEnabled);
      if (this.replayButton.buttonLabel) this.replayButton.buttonLabel.text = "全消去";

      if (calculating) {
        this.startButton.setInteractive(false);
        this.resetButton.setInteractive(false);
        this.replayButton.setInteractive(false);
      }
      var workEnabled = !this.tutorialActive && !this.running && !this.replaying && this.canStart;
      if (this.workButton) {
        this.workButton.alpha = workEnabled ? 1 : 0.45;
        this.workButton.setInteractive(workEnabled);
      }
      if (!workEnabled && this.workMenuOpen) this.closeWorkMenu();
      this.updateReplayCounter();
    },
    primaryAction: function () {
      if (this.tutorialActive || this.running) return;
      if (this.canStart) { this.start(); return; }
      if (this.replaying) {
        if (this.replayPaused) {
          this.replayPaused = false;
          this.updateButtons();
          this.playFrame();
        } else {
          this.replayPaused = true;
          this.tweener.clear();
          this.msg.text = "ちょっとタイム";
          this.updateButtons();
        }
        return;
      }
      if (this.frames.length > 0) this.startReplayFromBeginning();
    },
    startReplayFromBeginning: function () {
      if (!this.frames.length || this.running) return;
      this.replaying = true;
      this.replayPaused = false;
      this.fi = 0;
      this.replayCurrentIndex = -1;
      this.goalReached = false;
      this.setReplayNavVisible(true);
      this.resetCat();
      this.updateButtons();
      this.playFrame();
    },
    editAgain: function () {
      this.closeWorkMenu();
      if (this.running || !this.editBoard) return;
      // 再生中・一時停止中・一手送り/戻し中でも即座に編集へ戻る。
      this.tweener.clear();
      this.board = this.editBoard.clone();
      this.invalidateStoneDisplay();
      this.target = { x: TARGET.x, y: TARGET.y };
      this.turn = "white";
      this.running = false;
      this.replaying = false;
      this.replayPaused = false;
      this.canStart = true;
      this.frames = [];
      this.goalReached = false;
      this.piAnimating = false;
      this.replayCurrentIndex = -1;
      this.setReplayNavVisible(false);
      this.clearHints();
      this.last = null;
      this.resetCat();
      this.msg.text = "石を手直しして、もう一回！";
      this.render();
      this.updateButtons();
    },
    drawBase: function () {
      RectangleShape({
        width: BP + 56,
        height: BP + 56,
        fill: "#E1B866",
        stroke: "#8b5d27",
        strokeWidth: 5,
      })
        .setPosition(W / 2, T + BP / 2)
        .addChildTo(this.base);
      for (var i = 0; i < S; i++) {
        var a = pos(0, i),
          b = pos(S - 1, i);
        PathShape({
          paths: [a, b],
          stroke: "#332414",
          strokeWidth: 2,
        }).addChildTo(this.base);
        a = pos(i, 0);
        b = pos(i, S - 1);
        PathShape({
          paths: [a, b],
          stroke: "#332414",
          strokeWidth: 2,
        }).addChildTo(this.base);
      }
      [
        [3, 3],
        [3, 9],
        [6, 6],
        [9, 3],
        [9, 9],
      ].forEach((s) => {
        var p = pos(s[0], s[1]);
        CircleShape({ radius: 6, fill: "#332414", stroke: "transparent" })
          .setPosition(p.x, p.y)
          .addChildTo(this.base);
      });
    },
    createBoardSprites: function () {
      var gp = pos(GOAL.x, GOAL.y);
      this.goalCircle = CircleShape({ radius:23, fill:"#ffd600", stroke:"#fff", strokeWidth:5 })
        .setPosition(gp.x, gp.y).addChildTo(this);
      this.goalLabel = Label({ text:"Ｇ", fontSize:24, fill:"#000", fontWeight:"bold" })
        .setPosition(gp.x, gp.y).addChildTo(this);
      for (var y=0; y<S; y++) {
        this.stoneSprites[y] = [];
        for (var x=0; x<S; x++) {
          var p = pos(x,y);
          var stone = CircleShape({ radius:22, fill:"#151719", stroke:"#000", strokeWidth:2 })
            .setPosition(p.x,p.y).addChildTo(this);
          stone.visible = false;
          this.stoneSprites[y][x] = stone;
        }
      }
      this.lastMoveMarker = CircleShape({
          radius: 10,
          fill: "#fff",
          stroke: null,
      }).addChildTo(this);
      this.lastMoveMarker.visible = false;
    },
    invalidateStoneDisplay: function () {
      this.displayedCells = Array(S * S).fill(-1);
      this.displayedLastKey = "";
    },
    findPreviousWhiteMove: function (frameIndex) {
      // 現在より前のフレームから、実際に新しく置かれた白石を探す。
      for (var i = frameIndex - 1; i >= 0; i--) {
        var frame = this.frames[i];
        if (!frame || !frame.last) continue;
        var x = frame.last.x;
        var y = frame.last.y;
        var cellIndex = y * S + x;
        if (frame.cells[cellIndex] !== G.WHITE) continue;
        var before = i > 0 ? this.frames[i - 1].cells[cellIndex] : G.EMPTY;
        if (before === G.EMPTY) return { x: x, y: y };
      }
      // 最初に逃げる白石は、シチョウ開始地点から動いたものとして扱う。
      return { x: TARGET.x, y: TARGET.y };
    },
    playStoneMoveEffect: function (x, y, previousWhiteMove) {
      var sprite = this.stoneSprites[y] && this.stoneSprites[y][x];
      if (!sprite || !sprite.visible) return;

      var key = x + "," + y;
      var value = this.board.get(x, y);
      var destination = pos(x, y);
      this.moveEffectKey = key;

      sprite.tweener.clear();
      // 前回のアニメーションが途中で中断されても、必ず交点を基準に戻す。
      sprite.x = destination.x;
      sprite.y = destination.y;
      sprite.scaleX = 1;
      sprite.scaleY = 1;
      sprite.stroke = value === G.BLACK ? "#000" : "#aaa";
      sprite.strokeWidth = 2;

      if (value === G.BLACK) {
        SoundManager.play('blackSound');
        // 黒はその場を押さえる。位置は動かさない。
        sprite.scaleX = 1.25;
        sprite.scaleY = 1.25;
        sprite.tweener
          .to({ scaleX: 1, scaleY: 1 }, 100, "easeOutQuad")
          .call(() => {
            if (this.moveEffectKey === key) this.moveEffectKey = "";
          });
      } else if (value === G.WHITE) {
        SoundManager.play('whiteSound');
        // 白は前の白石から現在の交点へ逃げ込む方向を見せる。
        // 本来の交点より進行方向の逆側から、6pxだけ滑り込ませる。
        var from = previousWhiteMove || { x: TARGET.x, y: TARGET.y };
        var dx = x - from.x;
        var dy = y - from.y;
        var length = Math.hypot(dx, dy);
        var distance = 16;
        if (length > 0) {
          sprite.x = destination.x - (dx / length) * distance;
          sprite.y = destination.y - (dy / length) * distance;
        }
        // 位置移動を見せることを優先し、100ms全体を使って交点へ滑り込ませる。
        // 前版は6pxを40msで移動していたため、ほぼ知覚できなかった。
        sprite.scaleX = 0.95;
        sprite.scaleY = 0.95;
        sprite.tweener
          // ずらした初期位置を、少なくとも1回は画面に描画させる
          .wait(10)
          .to(
            {
              x: destination.x,
              y: destination.y,
              scaleX: 1.12,
              scaleY: 1.12,
            },
            90,
            "easeOutQuad"
          )
          .to({ scaleX: 1, scaleY: 1 }, 10, "easeOutQuad")
          .call(() => {
            // 次のフレームが始まる前に、必ず交点へ固定する。
            sprite.x = destination.x;
            sprite.y = destination.y;
            if (this.moveEffectKey === key) this.moveEffectKey = "";
          });
      }
    },
    updateStoneSprites: function () {
      var oldLast = this.displayedLastKey;
      var newLast = this.last ? this.last.x + "," + this.last.y : "";
      for (var y = 0; y < S; y++) {
        for (var x = 0; x < S; x++) {
          var i = y * S + x;
          var value = this.board.get(x, y);
          var sprite = this.stoneSprites[y][x];
          var isStone = value === G.BLACK || value === G.WHITE;
          var key = x + "," + y;
          var changed = this.displayedCells[i] !== value;

          if (changed) {
            if (isStone) {
              // ちらつき対策：色と輪郭を先に確定し、最後に表示する。
              sprite.fill = value === G.BLACK ? "#151719" : "#f8f4e8";
              sprite.stroke = value === G.BLACK ? "#000" : "#aaa";
              sprite.strokeWidth = 2;
              sprite.visible = true;
            } else {
              sprite.visible = false;
            }
            this.displayedCells[i] = value;
          }

          if (isStone && (changed || key === oldLast || key === newLast)) {
            sprite.stroke = value === G.BLACK ? "#000" : "#aaa";
            sprite.strokeWidth = 2;
          }
        }
      }
      if (this.last) {
        var lastValue = this.board.get(this.last.x, this.last.y);
        var lastSprite =
          this.stoneSprites[this.last.y][this.last.x];

        if (
          lastSprite &&
          lastSprite.visible &&
          (lastValue === G.BLACK || lastValue === G.WHITE)
        ) {
          this.lastMoveMarker.x = lastSprite.x;
          this.lastMoveMarker.y = lastSprite.y;

          // 黒石には白点、白石には黒点
          this.lastMoveMarker.fill =
              lastValue === G.BLACK ? "#fff" : "#000";

          this.lastMoveMarker.visible = true;
        } else {
          this.lastMoveMarker.visible = false;
        }
      } else {
        this.lastMoveMarker.visible = false;
      }

      this.displayedLastKey = newLast;
    },
    clear: function () {
      this.objects.forEach((o) => o.remove());
      this.objects = [];
    },
    add: function (o) {
      this.objects.push(o);
    },
    render: function () {
      this.clear();
      this.updateStoneSprites();
      var p;
      for (var m of this.branchMarkers) {
        p = pos(m.x, m.y);
        this.add(
          CircleShape({
            radius: 17,
            fill: "rgba(255,235,59,.18)",
            stroke: "#ffeb3b",
            strokeWidth: 6,
          })
            .setPosition(p.x, p.y)
            .addChildTo(this),
        );
        this.add(
          Label({
            text: "?",
            fontSize: 22,
            fill: "#5d4037",
            fontWeight: "bold",
          })
            .setPosition(p.x, p.y)
            .addChildTo(this),
        );
      }
      for (var s of this.captureStones) {
        p = pos(s.x, s.y);
        this.add(
          CircleShape({
            radius: 26,
            fill: "transparent",
            stroke: "#ff1744",
            strokeWidth: 6,
          })
            .setPosition(p.x, p.y)
            .addChildTo(this),
        );
      }
      for (var cm of this.captureMoves) {
        p = pos(cm.x, cm.y);
        this.add(
          CircleShape({
            radius: 17,
            fill: "rgba(255,235,59,.18)",
            stroke: "#ffeb3b",
            strokeWidth: 6,
          })
            .setPosition(p.x, p.y)
            .addChildTo(this),
        );
        this.add(
          Label({
            text: "!",
            fontSize: 24,
            fill: "#5d4037",
            fontWeight: "bold",
          })
            .setPosition(p.x, p.y)
            .addChildTo(this),
        );
      }

      // 通常の再描画では立った旗を表示。アニメーション時は別途生成する。
      if (!this.piAnimating) this.showPiFlag(false);
    },
    fixed: function (x, y) {
      return (
        (x === GOAL.x && y === GOAL.y) ||
        (x === TARGET.x && y === TARGET.y - 1) ||
        INIT.some((s) => s.x === x && s.y === y)
      );
    },
    clearHints: function () {
      this.branchMarkers = [];
      this.captureMoves = [];
      this.captureStones = [];
    },
    tap: function (px, py) {
      if (
        this.running ||
        this.replaying ||
        py < T - C / 2 ||
        py > T + BP + C / 2 ||
        px < L - C / 2 ||
        px > L + BP + C / 2
      )
        return;
      var x = Math.round((px - L) / C),
        y = Math.round((py - T) / C);
      if (this.fixed(x, y)) return;
      var p = pos(x, y);
      if (Math.hypot(px - p.x, py - p.y) > C * 0.45) return;
      var v = this.board.get(x, y);
      this.board.set(
        x,
        y,
        v === G.EMPTY ? G.WHITE : v === G.WHITE ? G.BLACK : G.EMPTY,
      );
      this.frames = [];
      this.clearHints();
      this.render();
    },
    normal: function () {
      var src = this.board,
        b = new G.GoBoard(S);
      for (var y = 0; y < S; y++)
        for (var x = 0; x < S; x++)
          if (!this.fixed(x, y)) {
            var v = src.get(x, y);
            if (v === G.BLACK || v === G.WHITE) b.set(x, y, v);
          }
      INIT.forEach((s) => b.set(s.x, s.y, s.c));
      b.set(TARGET.x, TARGET.y - 1, G.EMPTY);
      return b;
    },
    save: function (text) {
      this.frames.push({
        cells: this.board.cells.slice(),
        last: this.last ? { x: this.last.x, y: this.last.y } : null,
        branchMarkers: clonePoints(this.branchMarkers),
        captureMoves: clonePoints(this.captureMoves),
        captureStones: clonePoints(this.captureStones),
        text: text,
      });
    },
    start: function () {
      this.closeWorkMenu();
      if (this.running || this.replaying || !this.canStart) return;
      this.editBoard = this.board.clone();
      this.canStart = false;
      this.running = true;
      this.replaying = false;
      this.replayPaused = false;
      this.frames = [];
      this.simulationResult = null;
      this.goalReached = false;
      this.piAnimating = false;
      this.replayCurrentIndex = -1;
      this.setReplayNavVisible(true);
      this.clearHints();
      this.resetCat();
      this.msg.text = "最後まで考え中…";
      this.render();
      this.updateButtons();

      // メッセージを一度描画してから、同期的に最終結果まで計算する。
      this.tweener.clear().wait(30).call(() => this.calculateAll());
    },
    collectCaptureHints: function (r) {
      this.clearHints();
      var stoneSeen = Object.create(null), moveSeen = Object.create(null);
      for (var c of r.captures || []) {
        var mk = c.move.x + "," + c.move.y;
        if (!moveSeen[mk]) { moveSeen[mk] = true; this.captureMoves.push({ x: c.move.x, y: c.move.y }); }
        for (var stone of c.group.stones) {
          var sk = stone.x + "," + stone.y;
          if (!stoneSeen[sk]) { stoneSeen[sk] = true; this.captureStones.push({ x: stone.x, y: stone.y }); }
        }
      }
    },
    calculateAll: function () {
      this.board = this.normal();
      this.invalidateStoneDisplay();
      this.target = { x: TARGET.x, y: TARGET.y };
      this.turn = "white";
      this.moveCount = 1;
      this.last = null;
      this.clearHints();
      this.save("スタートだ！");

      var maxMoves = S * S * 4;
      var resultText = "読みが長すぎる…";
      var success = false;

      for (var i = 0; i < maxMoves; i++) {
        var engine = new G.LadderEngine(this.board, this.target, GOAL);
        var r;

        if (this.turn === "white") {
          r = engine.stepWhite();
          if (r.status === "goal") {
            if (r.board) { this.board = r.board; this.moveCount++; }
            this.last = r.move || this.last;
            this.clearHints();
            resultText = "ゴールだ！（" + this.moveCount + "手）";
            this.goalReached = true;
            this.save(resultText);
            success = true;
            break;
          }
          if (r.status === "white-branch" && r.board) {
            this.board = r.board; this.target = r.target; this.last = r.move; this.moveCount++;
            this.clearHints(); this.save("白が逃げる");
            var explanation = new G.LadderEngine(this.board, this.target, GOAL).explainBranch(this.board, this.target);
            if (explanation) {
              this.board = explanation.board; this.last = explanation.move; this.branchMarkers = explanation.liberties;
              resultText = "白の逃げ道が" + explanation.liberties.length + "つある！";
              this.save(resultText);
            } else {
              var group = this.board.groupAt(this.target.x, this.target.y);
              this.branchMarkers = this.board.playableLiberties(group);
              resultText = "白の逃げ道が" + this.branchMarkers.length + "つある！";
              this.save(resultText);
            }
            break;
          }
          if (r.status === "white-branch") {
            this.clearHints(); this.branchMarkers = r.liberties || [];
            resultText = "白の逃げ道が" + r.count + "つある！";
            this.save(resultText);
            break;
          }
          if (r.status === "white-can-capture") {
            this.collectCaptureHints(r); this.save("白が黒石を取れちゃう");
            resultText = "赤枠の黒石も取れちゃう";
            this.save(resultText);
            break;
          }
          if (r.status !== "ok") {
            resultText = ({ obstacle:"シチョウが続かない", "no-escape":"白はもう逃げられない", captured:"白はもう逃げられない", illegal:"白はそこに打てない" })[r.status] || "白が止まった";
            this.save(resultText);
            break;
          }
          this.board = r.board; this.target = r.target; this.turn = "black"; this.last = r.move; this.moveCount++;
          this.clearHints(); this.save("白が逃げる");
        } else {
          r = engine.chooseBlack();
          if (r.status !== "ok") { resultText = "黒はアタリを続けられない"; this.save(resultText); break; }
          this.board = r.board; this.target = r.target; this.turn = "white"; this.last = r.move; this.moveCount++;
          this.clearHints(); this.save("黒が追う");
        }
      }

      this.simulationResult = { text: resultText, success: success };
      this.running = false;
      this.replaying = true;
      this.replayPaused = false;
      this.fi = 0;
      this.replayCurrentIndex = -1;
      this.resetCat();
      this.updateButtons();
      this.playFrame();
    },
    showPiFlag: function (animate) {
      if (!this.goalReached || this.board.get(GOAL.x, GOAL.y) !== G.WHITE) return;

      var gp = pos(GOAL.x, GOAL.y);
      var flag = Sprite("pi")
        // 左下を白石中央に合わせ、回転支点にもする。
        .setOrigin(0, 1)
        .setPosition(gp.x, gp.y)
        .addChildTo(this);

      flag.width = 48;
      flag.height = 48;
      this.add(flag);

      if (!animate) {
        flag.rotation = 0;
        return;
      }

      // 右へ90度倒れた状態から、少し行き過ぎてパッと立つ。
      flag.rotation = 90;
      flag.tweener
        .clear()
        .to({ rotation: -8 }, 180, "easeOutBack")
        .to({ rotation: 0 }, 90, "easeOutQuad");
    },
    showGoalCelebration: function () {
      var center = pos(GOAL.x, GOAL.y);
      var colors = ["#ffd600", "#ff5252", "#42a5f5", "#ffffff"];
      var count = 24;

      // G周辺だけに小さな色粒を飛ばす控えめな祝福演出。
      for (let i = 0; i < count; i++) {
        var angle = (Math.PI * 2 * i) / count;
        var distance = 45 + (i % 3) * 10;
        var particle = CircleShape({
          radius: 5,
          fill: colors[i % colors.length],
          stroke: "transparent",
        }).setPosition(center.x, center.y).addChildTo(this);
        this.add(particle);

        particle.tweener.clear()
          .to({
              x: center.x + Math.cos(angle) * distance,
              y: center.y + Math.sin(angle) * distance,
            }, 800, "easeOutQuad")
          .to({
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
          }, 350, "easeOutQuad")
          .call(() => particle.remove());
      }

      // ゴール地点から黄色いリングを1回だけ広げる。
      var ring = CircleShape({
        radius: 24,
        fill: "transparent",
        stroke: "#ffd600",
        strokeWidth: 6,
      }).setPosition(center.x, center.y).addChildTo(this);
      this.add(ring);
      ring.tweener.clear()
        .to({ scaleX: 2.2, scaleY: 2.2, alpha: 0 }, 800, "easeOutQuad")
        .call(() => ring.remove());
    },
    showGoalEffect: function () {
      // 完成した盤面を隠さず、成功メッセージだけを軽く弾ませる。
      this.msg.tweener.clear();
      this.msg.scaleX = 1;
      this.msg.scaleY = 1;
      this.msg.tweener
        .to({ scaleX: 2, scaleY: 2 }, 140, "easeOutBack")
        .to({ scaleX: 1.0, scaleY: 1.0 }, 220, "easeOutQuad");
    },
    finish: function (text, hintType) {
      this.running = false;
      if (text.indexOf("成功") === 0 || text.indexOf("ゴール") === 0)
        this.showHappyCat();
      else
        this.showSadCat();
      this.msg.text = text;
      this.render();

      // 成功・失敗が出た直後から、最終フレームを現在位置として
      // 一手戻し・一手送りUIを使えるようにする。
      if (this.frames.length > 0) {
        this.replayCurrentIndex = this.frames.length - 1;
        this.fi = this.frames.length;
        this.setReplayNavVisible(true);
        this.updateReplayCounter();
      }

      this.updateButtons();
    },
    replay: function () {
      this.startReplayFromBeginning();
    },
    playFrame: function () {
      if (!this.replaying || this.replayPaused) return;
      if (this.fi >= this.frames.length) {
        this.replaying = false;
        this.replayPaused = false;
        this.replayCurrentIndex = this.frames.length - 1;
        this.fi = this.frames.length;
        this.setReplayNavVisible(true);
        this.updateReplayCounter();
        this.updateButtons();
        return;
      }
      this.showReplayFrame(this.fi);
      this.tweener.clear().wait(this.playbackInterval).call(() => this.playFrame());
    },
    reset: function () {
      this.closeWorkMenu();
      this.tweener.clear();
      this.board = newBoard();
      this.invalidateStoneDisplay();
      this.target = { x: TARGET.x, y: TARGET.y };
      this.running = false;
      this.replaying = false;
      this.replayPaused = false;
      this.canStart = true;
      this.editBoard = null;
      this.frames = [];
      this.simulationResult = null;
      this.goalReached = false;
      this.piAnimating = false;
      this.replayCurrentIndex = -1;
      this.setReplayNavVisible(false);
      this.clearHints();
      this.last = null;
      this.resetCat();
      this.msg.text =
        "空いてるところをタップすると\n白 → 黒 → 空 で変わるよ";
      this.render();
      this.updateButtons();
    },
  });
  phina.main(function () {
    GameApp({
      startLabel: "title",
      width: W,
      height: H,
      fit: true,
      assets: {
        image: {
          titleLogo: "title.png",
          neko1: "neko1.png",
          neko2: "neko2.png",
          neko3: "neko3.png",
          neko4: "neko4.png",
          pi: "pi.png",
        },
        sound: {
          blackSound: "black.mp3",
          whiteSound: "white.mp3",
          goalSound: "goal.mp3"
        },
      },
    }).run();
  });
})();
