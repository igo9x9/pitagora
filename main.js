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
  var TARGET = { x: 1, y: 11 };
  var STAGES = [
    { id: 1, name: "ステージ 1", goals: [{ x: 9, y: 9 }] },
    {
      id: 2,
      name: "ステージ 2",
      goals: [
        { x: 6, y: 6 },
        { x: 9, y: 9 },
      ],
    },
    {
      id: 3,
      name: "ステージ 3",
      goals: [
        { x: 9, y: 9 },
        { x: 9, y: 3 },
        { x: 3, y: 3 },
      ],
    },
    {
      id: 4,
      name: "ステージ 4",
      goals: [
        { x: 9, y: 9 },
        { x: 9, y: 3 },
        { x: 3, y: 3 },
        { x: 6, y: 6 },
      ],
    },
  ];
  // var GOALS = STAGES[0].goals;
  var GOALS = [];
  var INIT = [
    { x: 0, y: 10, c: G.BLACK },
    { x: 0, y: 11, c: G.BLACK },
    { x: 1, y: 11, c: G.WHITE },
    { x: 1, y: 12, c: G.BLACK },
    { x: 2, y: 11, c: G.BLACK },
  ];
  // チュートリアル専用の固定デモ。通常の盤面・LadderEngineとは独立。
  var TUTORIAL_DEMOS = {
    2: {
      initial: [],
      moves: [
        { x: 1, y: 10, c: G.WHITE },
        { x: 1, y: 9, c: G.BLACK },
        { x: 2, y: 10, c: G.WHITE },
        { x: 3, y: 10, c: G.BLACK },
        { x: 2, y: 9, c: G.WHITE },
        { x: 2, y: 8, c: G.BLACK },
        { x: 3, y: 9, c: G.WHITE },
      ],
    },
    3: {
      initial: [
        { x: 1, y: 10, c: G.WHITE },
        { x: 1, y: 9, c: G.BLACK },

        { x: 4, y: 6, c: G.BLACK },
        { x: 5, y: 6, c: G.BLACK },
        { x: 4, y: 7, c: G.WHITE },
        { x: 5, y: 7, c: G.WHITE },
      ],
      moves: [
        { x: 2, y: 10, c: G.WHITE },
        { x: 3, y: 10, c: G.BLACK },
        { x: 2, y: 9, c: G.WHITE },
        { x: 2, y: 8, c: G.BLACK },
        { x: 3, y: 9, c: G.WHITE },
        { x: 4, y: 9, c: G.BLACK },
        { x: 3, y: 8, c: G.WHITE },
        { x: 3, y: 7, c: G.BLACK },
        { x: 4, y: 8, c: G.WHITE },
        { x: 6, y: 7, c: G.BLACK },
        { x: 5, y: 8, c: G.WHITE },
        { x: 5, y: 9, c: G.BLACK },
        { x: 6, y: 8, c: G.WHITE },
        { x: 7, y: 8, c: G.BLACK },
        { x: 6, y: 9, c: G.WHITE },
        { x: 6, y: 10, c: G.BLACK },
        { x: 7, y: 9, c: G.WHITE },
      ],
    },
  };
  // チュートリアル説明カードのY座標。ページごとにここだけ調整できる。
  var TUTORIAL_CARD_Y = {
    1: 465,
    2: 485,
    3: 355,
    4: 455,
    5: 390,
    6: 485,
  };
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
    r.buttonBaseY = y;

    // 押した瞬間に少し縮み、3px沈むことで明確な押下感を返す。
    // WorkMenuSceneはonpointendを独自利用するため、復帰は自動Tweenerで完結させる。
    r.onpointstart = function () {
      if (r.alpha < 0.5) return;
      r.tweener.clear();
      r.scaleX = 0.94;
      r.scaleY = 0.94;
      r.y = r.buttonBaseY + 3;
      r.tweener
        .wait(45)
        .to({ scaleX: 1, scaleY: 1, y: r.buttonBaseY }, 90, "easeOutQuad");
      if (fn) fn();
    };
    return r;
  }
  function clonePoints(a) {
    return (a || []).map((p) => ({ x: p.x, y: p.y }));
  }
  // 正式な保存・共有形式: goals + cells。ステージ番号は持たない。
  // URLでは1つのpパラメータにJSONをURL-safe Base64化して格納する。
  function bytesToUrlBase64(bytes) {
    var binary = String.fromCharCode.apply(null, bytes);
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  function urlBase64ToBytes(payload) {
    var base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    var binary = atob(base64);
    return Array.from(binary, (ch) => ch.charCodeAt(0));
  }
  function encodeCells(cells) {
    var bytes = [];
    for (var i = 0; i < cells.length; i += 4) {
      var byte = 0;
      for (var j = 0; j < 4; j++) {
        var value = cells[i + j];
        var v = value === G.BLACK ? 1 : value === G.WHITE ? 2 : 0;
        byte |= v << (j * 2);
      }
      bytes.push(byte);
    }
    return bytesToUrlBase64(bytes);
  }
  function decodeCells(payload) {
    var bytes = urlBase64ToBytes(payload);
    var cells = [];
    for (var i = 0; i < bytes.length; i++) {
      for (var j = 0; j < 4 && cells.length < S * S; j++) {
        var v = (bytes[i] >> (j * 2)) & 3;
        if (v === 3) throw new Error("配置データに不正な値があります");
        cells.push(v === 1 ? G.BLACK : v === 2 ? G.WHITE : G.EMPTY);
      }
    }
    if (cells.length !== S * S) throw new Error("配置データの長さが違います");
    return cells;
  }
  function validateGoals(goals) {
    if (!Array.isArray(goals) || goals.length < 1)
      throw new Error("ゴール情報がありません");
    var seen = Object.create(null);
    return goals.map((goal) => {
      var x = Number(goal.x),
        y = Number(goal.y);
      if (
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        y < 0 ||
        x >= S ||
        y >= S
      )
        throw new Error("ゴール座標が不正です");
      var key = x + "," + y;
      if (seen[key]) throw new Error("ゴール座標が重複しています");
      seen[key] = true;
      return { x: x, y: y };
    });
  }
  function encodePosition(position) {
    var compact = {
      v: 1,
      g: validateGoals(position.goals).map((goal) => [goal.x, goal.y]),
      c: encodeCells(position.cells),
    };
    var utf8 = unescape(encodeURIComponent(JSON.stringify(compact)));
    return btoa(utf8)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  function decodePosition(payload) {
    var base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    var json = decodeURIComponent(escape(atob(base64)));
    var data = JSON.parse(json);
    if (
      !data ||
      data.v !== 1 ||
      !Array.isArray(data.g) ||
      typeof data.c !== "string"
    )
      throw new Error("未対応の配置形式です");
    return {
      version: 1,
      size: S,
      goals: validateGoals(data.g.map((g) => ({ x: g[0], y: g[1] }))),
      cells: decodeCells(data.c),
    };
  }
  function readSharedBoardFromUrl() {
    try {
      var url = new URL(window.location.href);
      var raw = url.searchParams.get("p");
      if (!raw) return null;

      // まず復元
      var position = decodePosition(raw);

      // 正常に復元できてからpだけ削除
      url.searchParams.delete("p");

      history.replaceState(null, "", url.toString());

      return position;
    } catch (e) {
      console.warn("共有配置を読み込めませんでした", e);
      return null;
    }
  }
  var SHARED_BOARD = readSharedBoardFromUrl();
  phina.define("TitleScene", {
    superClass: "DisplayScene",
    nextLabel: "main",
    init: function () {
      this.superInit({ width: W, height: H });
      this.backgroundColor = "#159447";
      if (SHARED_BOARD) {
        this.tweener.wait(1).call(() => this.exit("main"));
        return;
      }

      // タイトル画像
      var titleLogo = Sprite("titleLogo")
        .addChildTo(this)
        .setPosition(W / 2, 400);

      var targetWidth = 600;
      var scale = targetWidth / titleLogo.width;
      titleLogo.setScale(scale);

      btn(this, W / 2, 800, 230, "はじめる", "#ef6c00", () => {
        // 押下状態を先に1フレーム以上見せてからMainSceneを生成する。
        this.tweener
          .clear()
          .wait(110)
          .call(() => this.exit("main"));
      });
    },
  });
  phina.define("StageSelectScene", {
    superClass: "DisplayScene",
    init: function (options) {
      this.superInit({ width: W, height: H });
      options = options || {};
      this.backgroundColor = "rgba(0,0,0,0.18)";
      // 初回・通常時とも同じ大きさと同じ配置にする。
      RectangleShape({
        width: 460,
        height: 680,
        cornerRadius: 22,
        fill: "rgba(20,35,45,0.97)",
        stroke: "#fff",
        strokeWidth: 4,
      })
        .setPosition(W / 2, H / 2)
        .addChildTo(this);
      Label({
        text: "ステージをえらぶ",
        fontSize: 34,
        fill: "#fff",
        fontWeight: "bold",
      })
        .setPosition(W / 2, 325)
        .addChildTo(this);
      [440, 540, 640, 740].forEach((y, index) => {
        var stage = STAGES[index];
        var b = btn(
          this,
          W / 2,
          y,
          340,
          stage.name + "　G × " + stage.goals.length,
          "#1976d2",
          () => {},
        );
        b.onpointend = () => {
          if (options.onSelect) options.onSelect(stage);
          setTimeout(() => this.app.popScene(), 0);
        };
      });

      // 閉じるボタン自体は常に表示し、初回だけ非活性にする。
      var closeButton = btn(
        this,
        W / 2,
        865,
        260,
        "閉じる",
        "#607d8b",
        () => {},
      );
      if (options.canClose) {
        closeButton.onpointend = () => setTimeout(() => this.app.popScene(), 0);
      } else {
        closeButton.fill = "#777777";
        closeButton.alpha = 0.55;
        closeButton.setInteractive(false);
      }
    },
  });
  phina.define("WorkMenuScene", {
    superClass: "DisplayScene",
    init: function (options) {
      this.superInit({ width: W, height: H });
      options = options || {};
      this.backgroundColor = "rgba(0,0,0,0.15)";
      RectangleShape({
        width: 350,
        height: 660,
        cornerRadius: 18,
        fill: "rgba(20,35,45,0.96)",
        stroke: "#fff",
        strokeWidth: 4,
      })
        .setPosition(W / 2, 575)
        .addChildTo(this);
      var menuButton = (y, text, color, action) => {
        var button = btn(this, W / 2, y, 280, text, color, () => {});
        button.onpointend = () => {
          if (action) action();
          setTimeout(() => this.app.popScene(), 0);
        };
      };
      menuButton(320, "ステージをえらぶ", "#00897b", options.onStageSelect);
      menuButton(430, "この配置を保存", "#ef6c00", options.onSave);
      menuButton(520, "保存した配置を読込", "#1976d2", options.onLoad);
      menuButton(630, "共有リンクをコピー", "#4A4A44", options.onShare);
      menuButton(740, "タイトルへ戻る", "#795548", options.onTitle);
      menuButton(830, "閉じる", "#607d8b", null);
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
      this.runMoves = [];
      this.previousRunMoves = null;
      this.compareAfterEdit = false;
      this.beforeEditCells = null;
      this.branchMarkers = [];
      this.captureMoves = [];
      this.captureStones = [];
      this.last = null;
      this.tutorialStep = 1;
      this.tutorialActive = true;
      this.tutorialObjects = [];
      this.tutorialDemoObjects = [];
      this.tutorialDemoTimer = DisplayElement().addChildTo(this);
      this.tutorialDemoToken = 0;
      this.replayNavVisible = false;
      this.replayCurrentIndex = -1;
      this.playbackInterval = 300;
      this.simulationResult = null;
      this.goalReached = false;
      this.currentStageId = 1;
      this.goals = GOALS.map((goal) => ({ x: goal.x, y: goal.y }));
      this.reachedGoalKeys = Object.create(null);
      this.goalFadeAnimatingKey = null;
      this.piAnimating = false;
      this.stoneSprites = [];
      this.displayedCells = Array(S * S).fill(-1);
      this.displayedLastKey = "";
      this.moveEffectKey = "";
      this.storageKey = "pitagora-shicho-position";
      this.workMenuOpen = false;
      this.workMenuObjects = [];
      // 編集時の短押し/長押し判定用。短押し=白、280ms長押し=黒。
      this.placePress = null;
      this.placePressThreshold = 280;
      this.placePressCancelDistance = 32;
      this.sharedBoardLoaded = false;
      if (SHARED_BOARD) {
        this.currentStageId = null;
        this.goals = SHARED_BOARD.goals.map((goal) => ({
          x: goal.x,
          y: goal.y,
        }));
        this.board = new G.GoBoard(S, SHARED_BOARD.cells.slice());
        INIT.forEach((stone) => this.board.set(stone.x, stone.y, stone.c));
        this.board.set(TARGET.x, TARGET.y - 1, G.EMPTY);
        this.goals.forEach((goal) => this.board.set(goal.x, goal.y, G.EMPTY));
        this.tutorialActive = false;
        this.sharedBoardLoaded = true;
      }
      this.boardLayer = DisplayElement().addChildTo(this);
      this.base = DisplayElement().addChildTo(this.boardLayer);
      this.drawBase();
      this.createBoardSprites();
      this.ensureGoalSprites();
      this.tutorialBoardOffsetY = 185;
      if (this.tutorialActive) this.boardLayer.y = this.tutorialBoardOffsetY;
      this.msg = Label({
        text: "",
        fontSize: 30,
        fill: "#fff",
        lineHeight: 1.35,
      })
        .setPosition(W / 2, MY)
        .addChildTo(this);
      if (this.sharedBoardLoaded) {
        this.msg.text = "共有された配置です。スタートしてみよう！";
      }
      // 4つの操作を横一列に配置。右端の細い「⋮」は作品メニュー。
      this.startButton = btn(this, 115, BY, 180, "スタート", "#ef6c00", () =>
        this.primaryAction(),
      );
      this.resetButton = btn(this, 310, BY, 160, "手直し", "#1976d2", () =>
        this.editAgain(),
      );
      this.replayButton = btn(this, 485, BY, 150, "全消去", "#607d8b", () =>
        this.reset(),
      );
      this.workButton = btn(this, 655, BY, 70, "⋮", "#4A4A44", () =>
        this.toggleWorkMenu(),
      );
      if (this.workButton.buttonLabel)
        this.workButton.buttonLabel.fontSize = 34;
      // 一手移動と速度設定を同じ行にまとめる。
      this.prevReplayButton = btn(this, 95, BY + 92, 70, "◀", "#4A4A44", () =>
        this.stepReplay(-1),
      );
      this.replayCounter = Label({
        text: "0 / 0",
        fontSize: 22,
        fill: "#fff",
        fontWeight: "bold",
      })
        .setPosition(190, BY + 92)
        .addChildTo(this);
      this.nextReplayButton = btn(this, 285, BY + 92, 70, "▶", "#4A4A44", () =>
        this.stepReplay(1),
      );
      this.slowSpeedButton = btn(this, 410, BY + 92, 64, "遅", "#607d8b", () =>
        this.setPlaybackSpeed(500),
      );
      this.normalSpeedButton = btn(
        this,
        500,
        BY + 92,
        64,
        "中",
        "#607d8b",
        () => this.setPlaybackSpeed(300),
      );
      this.fastSpeedButton = btn(this, 590, BY + 92, 64, "速", "#607d8b", () =>
        this.setPlaybackSpeed(150),
      );
      this.setReplayNavVisible(false);
      this.updateSpeedButtons();
      this.updateButtons();
      // チュートリアル中は通常操作の4ボタンを完全に隠す。
      // 共有URL起動ではtutorialActive=falseなので最初から表示する。
      if (this.tutorialActive) this.setMainButtonsVisible(false);
      this.onpointstart = (e) => {
        if (this.tutorialActive) {
          this.nextTutorial();
          return;
        }
        this.beginPlacementPress(e.pointer.x, e.pointer.y);
      };
      this.onpointmove = (e) => {
        this.movePlacementPress(e.pointer.x, e.pointer.y);
      };
      this.onpointend = (e) => {
        this.endPlacementPress(e.pointer.x, e.pointer.y);
      };
      this.render();
      this.showTutorialStep();
    },
    toggleWorkMenu: function () {
      if (this.tutorialActive || this.running) return;
      if (this.replaying && !this.replayPaused) {
        this.replayPaused = true;
        this.tweener.clear();
        this.updateButtons();
      }
      this.openWorkMenu();
    },
    openWorkMenu: function () {
      if (!this.app) return;
      var mainScene = this;
      this.app.pushScene(
        WorkMenuScene({
          onSave: function () {
            mainScene.saveBoardToLocalStorage();
          },
          onLoad: function () {
            mainScene.loadBoardFromLocalStorage();
          },
          onShare: function () {
            mainScene.copyShareUrl();
          },
          onStageSelect: function () {
            setTimeout(() => mainScene.openStageSelect(true), 30);
          },
          onTitle: function () {
            mainScene.returnToTitle();
          },
        }),
      );
    },
    closeWorkMenu: function () {
      // 互換用：作品メニューは専用SceneなのでMainScene側では処理不要。
    },
    openStageSelect: function (canClose) {
      if (!this.app) return;
      var mainScene = this;
      this.app.pushScene(
        StageSelectScene({
          canClose: !!canClose,
          onSelect: function (stage) {
            mainScene.selectStage(stage);
          },
        }),
      );
    },
    selectStage: function (stage) {
      if (!stage) return;
      this.currentStageId = stage.id;
      this.goals = stage.goals.map((g) => ({ x: g.x, y: g.y }));
      this.ensureGoalSprites();
      this.tweener.clear();
      this.board = newBoard();
      this.invalidateStoneDisplay();
      this.target = { x: TARGET.x, y: TARGET.y };
      this.turn = "white";
      this.running = false;
      this.replaying = false;
      this.replayPaused = false;
      this.canStart = true;
      this.editBoard = null;
      this.frames = [];
      this.runMoves = [];
      this.previousRunMoves = null;
      this.compareAfterEdit = false;
      this.beforeEditCells = null;
      this.simulationResult = null;
      this.goalReached = false;
      this.reachedGoalKeys = Object.create(null);
      this.goalFadeAnimatingKey = null;
      this.piAnimating = false;
      this.replayCurrentIndex = -1;
      this.setReplayNavVisible(false);
      this.clearHints();
      this.last = null;
      // ステージ番号に依存しない通常の編集メッセージへ統一する。
      // URL共有/LocalStorageから独立配置を開く場合にも同じ文言を使える。
      this.msg.text = "自由に石を置こう！\nタップで白、長押しで黒です";
      this.render();
      this.updateButtons();
    },
    returnToTitle: function () {
      SHARED_BOARD = null;
      // WorkMenuSceneがpopされた直後にMainSceneを終了し、タイトルへ戻す。
      setTimeout(() => this.exit("title"), 30);
    },
    ensureGoalSprites: function () {
      this.goals.forEach((goal) => {
        var key = this.goalKey(goal);
        if (this.goalSprites.some((item) => this.goalKey(item.goal) === key))
          return;
        var gp = pos(goal.x, goal.y);
        // 動的追加でも石より奥になるよう、既存石をいったん前面へ追加し直すことはせず、
        // G自体は盤面上で石に隠れてよい仕様なので通常描画順を維持する。
        var circle = CircleShape({
          radius: 23,
          fill: "#ffff00",
          stroke: "#000",
          strokeWidth: 8,
        })
          .setPosition(gp.x, gp.y)
          .addChildTo(this.boardLayer);
        var label = Label({
          text: "Ｇ",
          fontSize: 24,
          fill: "#000",
          fontWeight: "bold",
        })
          .setPosition(gp.x, gp.y)
          .addChildTo(this.boardLayer);
        this.goalSprites.push({
          goal: { x: goal.x, y: goal.y },
          circle: circle,
          label: label,
        });
      });
    },
    boardForExport: function () {
      // 編集中は現在盤面。START後は実行結果ではなく、START直前の配置を保存・共有する。
      if (this.canStart) return this.board;
      if (this.editBoard) return this.editBoard;
      return this.board;
    },
    currentPositionData: function () {
      return {
        version: 1,
        size: S,
        goals: this.goals.map((goal) => ({ x: goal.x, y: goal.y })),
        cells: this.boardForExport().cells.slice(),
      };
    },
    normalizeBoardForEditing: function (board) {
      INIT.forEach((stone) => board.set(stone.x, stone.y, stone.c));
      board.set(TARGET.x, TARGET.y - 1, G.EMPTY);
      this.goals.forEach((goal) => board.set(goal.x, goal.y, G.EMPTY));
      return board;
    },
    createShareUrl: function () {
      if (this.running) return null;
      var payload = encodePosition(this.currentPositionData());
      var url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("p", payload);
      return url.toString();
    },
    copyShareUrl: function () {
      var url = this.createShareUrl();
      if (!url) return;
      var done = () => {
        this.msg.text = "共有リンクをコピーしました";
      };
      var failed = (e) => {
        console.error("共有リンクのコピーに失敗", e);
        this.msg.text = "リンクをコピーできません…";
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(url)
          .then(done)
          .catch(() => this.copyTextFallback(url, done, failed));
      } else {
        this.copyTextFallback(url, done, failed);
      }
    },
    copyTextFallback: function (text, done, failed) {
      try {
        var area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.focus();
        area.select();
        if (!document.execCommand("copy"))
          throw new Error("copy command failed");
        area.remove();
        done();
      } catch (e) {
        failed(e);
      }
    },
    serializeBoardForStorage: function () {
      var data = this.currentPositionData();
      data.savedAt = new Date().toISOString();
      return data;
    },
    saveBoardToLocalStorage: function () {
      if (this.running) return;
      try {
        localStorage.setItem(
          this.storageKey,
          JSON.stringify(this.serializeBoardForStorage()),
        );
        this.msg.text = "この配置を保存しました";
      } catch (e) {
        console.error("盤面の保存に失敗", e);
        this.msg.text = "保存できませんでした";
      }
    },
    loadBoardFromLocalStorage: function () {
      try {
        var raw = localStorage.getItem(this.storageKey);
        if (!raw) {
          this.msg.text = "保存した配置がありません";
          return;
        }
        var data = JSON.parse(raw);
        if (
          !data ||
          data.version !== 1 ||
          data.size !== S ||
          !Array.isArray(data.cells) ||
          data.cells.length !== S * S
        )
          throw new Error("保存データの形式が違います");
        this.currentStageId = null;
        this.goals = validateGoals(data.goals);
        this.ensureGoalSprites();
        this.board = new G.GoBoard(S, data.cells.slice());
        this.normalizeBoardForEditing(this.board);
        this.invalidateStoneDisplay();
        this.target = { x: TARGET.x, y: TARGET.y };
        this.turn = "white";
        this.running = false;
        this.replaying = false;
        this.replayPaused = false;
        this.canStart = true;
        this.editBoard = null;
        this.frames = [];
        this.runMoves = [];
        this.previousRunMoves = null;
        this.compareAfterEdit = false;
        this.beforeEditCells = null;
        this.simulationResult = null;
        this.goalReached = false;
        this.reachedGoalKeys = Object.create(null);
        this.goalFadeAnimatingKey = null;
        this.piAnimating = false;
        this.replayCurrentIndex = -1;
        this.setReplayNavVisible(false);
        this.clearHints();
        this.last = null;
        this.msg.text = "自由に石を置こう！\nタップで白、長押しで黒です";
        this.render();
        this.updateButtons();
      } catch (e) {
        console.error("盤面の読込に失敗", e);
        this.msg.text = "読み込めませんでした";
      }
    },
    setReplayNavVisible: function (visible) {
      this.replayNavVisible = visible;
      if (this.prevReplayButton) this.prevReplayButton.visible = visible;
      if (this.nextReplayButton) this.nextReplayButton.visible = visible;
      if (this.replayCounter) this.replayCounter.visible = visible;
      if (this.slowSpeedButton) this.slowSpeedButton.visible = visible;
      if (this.normalSpeedButton) this.normalSpeedButton.visible = visible;
      if (this.fastSpeedButton) this.fastSpeedButton.visible = visible;
      if (visible) this.updateSpeedButtons();
    },
    setPlaybackSpeed: function (milliseconds) {
      this.playbackInterval = milliseconds;
      this.updateSpeedButtons();
      if (this.replaying && !this.replayPaused) {
        this.tweener
          .clear()
          .wait(this.playbackInterval)
          .call(() => this.playFrame());
      }
    },
    updateSpeedButtons: function () {
      [
        { button: this.slowSpeedButton, value: 500 },
        { button: this.normalSpeedButton, value: 300 },
        { button: this.fastSpeedButton, value: 150 },
      ].forEach((item) => {
        if (!item.button) return;
        var selected = this.playbackInterval === item.value;
        item.button.fill = selected ? "#ffd600" : "#607d8b";
        item.button.alpha = selected ? 1 : 0.78;
        if (item.button.buttonLabel)
          item.button.buttonLabel.fill = selected ? "#000" : "#fff";
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
      this.goalReached = f.text.indexOf("ゴール！") === 0;
      this.replayCurrentIndex = index;
      this.fi = index + 1;
      this.board = new G.GoBoard(S, f.cells);
      this.last = f.last;
      this.branchMarkers = f.branchMarkers || [];
      this.captureMoves = f.captureMoves || [];
      this.captureStones = f.captureStones || [];
      var previousReachedKeys = Object.assign({}, this.reachedGoalKeys);
      this.reachedGoalKeys = Object.assign(
        Object.create(null),
        f.reachedGoalKeys || {},
      );
      var newlyReachedGoals = this.goals.filter(
        (goal) =>
          !previousReachedKeys[this.goalKey(goal)] &&
          this.reachedGoalKeys[this.goalKey(goal)],
      );
      this.msg.text = f.text;
      if (!this.goalReached && index === this.frames.length - 1) {
        SoundManager.play("failSound");
      }
      if (this.goalReached && !wasGoalReached) {
        // ゴールへ入った瞬間は、旗なしの盤面を描いてから旗を立てる。
        this.piAnimating = true;
        this.render();
        this.showPiFlag(true);
        this.showGoalCelebration();
        // 「ゴール！」もポンッと拡大
        this.showGoalEffect();
        this.piAnimating = false;
        // 音は次のイベントループへ
        setTimeout(() => {
          SoundManager.play("goalSound");
        }, 0);
      } else {
        this.render();
        if (!this.goalReached && newlyReachedGoals.length) {
          newlyReachedGoals.forEach((goal) => this.animatePassedGoal(goal));
          setTimeout(() => {
            SoundManager.play("pointSound");
          }, 0);
        }
      }
      // 自動再生中、新しく石が置かれたフレームだけ着手エフェクト
      if (!this.replayPaused && f.last) {
        var li = f.last.y * S + f.last.x;

        var prevValue = index > 0 ? this.frames[index - 1].cells[li] : G.EMPTY;

        var nowValue = f.cells[li];

        if (
          prevValue === G.EMPTY &&
          (nowValue === G.BLACK || nowValue === G.WHITE)
        ) {
          var previousWhiteMove =
            nowValue === G.WHITE ? this.findPreviousWhiteMove(index) : null;
          this.playStoneMoveEffect(f.last.x, f.last.y, previousWhiteMove);
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
    clearTutorialDemo: function () {
      this.tutorialDemoToken += 1;
      if (this.tutorialDemoTimer) this.tutorialDemoTimer.tweener.clear();
      this.tutorialDemoObjects.forEach((o) => o.remove());
      this.tutorialDemoObjects = [];
      this.invalidateStoneDisplay();
      this.render();
    },
    clearTutorial: function () {
      this.clearTutorialDemo();
      this.tutorialObjects.forEach((o) => o.remove());
      this.tutorialObjects = [];
    },
    addTutorial: function (o) {
      this.tutorialObjects.push(o);
      return o;
    },
    addTutorialDemo: function (o) {
      this.tutorialDemoObjects.push(o);
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
        .addChildTo(this.boardLayer);
      shade.alpha = alpha;
      this.addTutorial(shade);
    },
    addSpotlightCurtains: function (holeX, holeY, holeWidth, holeHeight) {
      var bl = L - 28,
        bt = T - 28,
        br = L + BP + 28,
        bb = T + BP + 28;
      var hl = Math.max(bl, holeX - holeWidth / 2),
        ht = Math.max(bt, holeY - holeHeight / 2),
        hr = Math.min(br, holeX + holeWidth / 2),
        hb = Math.min(bb, holeY + holeHeight / 2),
        a = 0.42;
      this.addTutorialShade((bl + br) / 2, (bt + ht) / 2, br - bl, ht - bt, a);
      this.addTutorialShade((bl + br) / 2, (hb + bb) / 2, br - bl, bb - hb, a);
      this.addTutorialShade((bl + hl) / 2, (ht + hb) / 2, hl - bl, hb - ht, a);
      this.addTutorialShade((hr + br) / 2, (ht + hb) / 2, br - hr, hb - ht, a);
    },
    popTutorialElement: function (el, delay, scale) {
      if (!el) return;
      var bx = el.scaleX || 1,
        by = el.scaleY || 1;
      el.alpha = 0;
      el.scaleX = bx * (scale || 0.82);
      el.scaleY = by * (scale || 0.82);
      el.tweener
        .clear()
        .wait(delay || 0)
        .to(
          { alpha: 1, scaleX: bx * 1.06, scaleY: by * 1.06 },
          105,
          "easeOutQuad",
        )
        .to({ scaleX: bx, scaleY: by }, 65, "easeOutQuad");
    },
    createTutorialStone: function (m) {
      var p = pos(m.x, m.y),
        o = CircleShape({
          radius: 22,
          fill: m.c === G.BLACK ? "#151719" : "#f8f4e8",
          stroke: m.c === G.BLACK ? "#000" : "#aaa",
          strokeWidth: 2,
        })
          .setPosition(p.x, p.y)
          .addChildTo(this.boardLayer);
      o.alpha = 0;
      o.scaleX = o.scaleY = 0.72;
      o.tweener
        .to({ alpha: 1, scaleX: 1.08, scaleY: 1.08 }, 90, "easeOutQuad")
        .to({ scaleX: 1, scaleY: 1 }, 55, "easeOutQuad");
      return this.addTutorialDemo(o);
    },
    createTutorialGoal: function (x, y) {
      var p = pos(x, y),
        h = DisplayElement().setPosition(p.x, p.y).addChildTo(this.boardLayer);
      CircleShape({
        radius: 23,
        fill: "#ffff00",
        stroke: "#000",
        strokeWidth: 8,
      }).addChildTo(h);
      Label({
        text: "Ｇ",
        fontSize: 24,
        fill: "#000",
        fontWeight: "bold",
      }).addChildTo(h);
      return this.addTutorialDemo(h);
    },
    startTutorialDemo: function (demo) {
      var token = ++this.tutorialDemoToken,
        page = this.tutorialStep;
      var cycle = () => {
        if (
          !this.tutorialActive ||
          this.tutorialStep !== page ||
          token !== this.tutorialDemoToken
        )
          return;
        this.tutorialDemoObjects.forEach((o) => o.remove());
        this.tutorialDemoObjects = [];
        (demo.initial || []).forEach((m) => this.createTutorialStone(m));
        var i = 0;
        var next = () => {
          if (
            !this.tutorialActive ||
            this.tutorialStep !== page ||
            token !== this.tutorialDemoToken
          )
            return;
          if (i >= demo.moves.length) {
            this.tutorialDemoTimer.tweener.clear().wait(850).call(cycle);
            return;
          }
          this.createTutorialStone(demo.moves[i++]);
          this.tutorialDemoTimer.tweener.clear().wait(280).call(next);
        };
        this.tutorialDemoTimer.tweener
          .clear()
          .wait(page === 4 ? 620 : 420)
          .call(next);
      };
      cycle();
    },
    createTutorialTextCard: function (text, y, height) {
      var h = DisplayElement()
        .setPosition(W / 2, y)
        .addChildTo(this);
      RectangleShape({
        width: 620,
        height: height || 165,
        cornerRadius: 22,
        fill: "rgba(255,255,255,0.995)",
        stroke: "#eeeeee",
        strokeWidth: 3,
      }).addChildTo(h);
      Label({
        text: text,
        fontSize: 32,
        fill: "#202020",
        fontWeight: "bold",
        lineHeight: 1.35,
        align: "center",
      }).addChildTo(h);
      this.addTutorial(h);
      return h;
    },
    showTutorialStep: function () {
      this.clearTutorial();
      if (!this.tutorialActive) return;
      var text = "",
        height = 170,
        arrow = null;
      if (this.tutorialStep === 1) {
        // var p = pos(TARGET.x, TARGET.y);
        // this.addSpotlightCurtains(p.x - C * 0.45, p.y, C * 4, C * 3.2);
        text =
          "このゲームはシチョウで遊びます\n\nここから白が逃げ出して\n黒が追いかけます";
        height = 225;
        arrow = Sprite("arrow")
          .setPosition(W / 2 - 240, 630)
          .addChildTo(this);
        this.addTutorial(arrow);
      } else if (this.tutorialStep === 2) {
        text = "逃げたり、追いかけたりは\nアプリが自動で行います";
        this.startTutorialDemo(TUTORIAL_DEMOS[2]);
      } else if (this.tutorialStep === 3) {
        text =
          "あらかじめ石を配置することで\nシチョウの進む方向を変えられます\n\nこれがこのゲームのポイントです！";
        this.startTutorialDemo(TUTORIAL_DEMOS[3]);
        height = 235;
        arrow = Sprite("arrow")
          .setPosition(W / 2 + 55, 530)
          .setRotation(90)
          .addChildTo(this);
        arrow.scaleX *= -1;
        this.addTutorial(arrow);
      } else if (this.tutorialStep === 4) {
        // var g = pos(this.goals[0].x, this.goals[0].y);
        // this.addSpotlightCurtains(g.x, g.y, C * 2.2, C * 2.2);
        this.createTutorialGoal(9, 9);
        text = "白がG（ゴール）に来れたら\nステージクリア！";
        arrow = Sprite("arrow")
          .setPosition(W / 2 + 135, 590)
          .addChildTo(this);
        arrow.scaleX *= -1;
        this.addTutorial(arrow);
      } else if (this.tutorialStep === 5) {
        arrow = Sprite("arrow")
          .setPosition(W / 2 + 135, 590)
          .addChildTo(this);
        arrow.scaleX *= -1;
        this.addTutorial(arrow);
        arrow = Sprite("arrow")
          .setPosition(W / 2 - 10, 590)
          .addChildTo(this);
        arrow.scaleX *= -1;
        this.addTutorial(arrow);
        this.createTutorialGoal(6, 9);
        this.createTutorialGoal(9, 9);
        text = "Gがいくつかあるステージは\nすべてを通過できたらクリア！";
      } else {
        text =
          "最後に、このゲームでは\n黒石が取られると失敗です\n（なのでホウリコミはできません）\n\nでは始めましょう！";
        height = 305;
      }
      var cardY = TUTORIAL_CARD_Y[this.tutorialStep] || 485;
      var card = this.createTutorialTextCard(text, cardY, height);
      this.popTutorialElement(card, this.tutorialStep === 1 ? 300 : 70, 0.86);
      if (arrow)
        this.popTutorialElement(
          arrow,
          this.tutorialStep === 1 ? 500 : 210,
          0.72,
        );
    },
    nextTutorial: function () {
      if (!this.tutorialActive) return;
      if (this.tutorialStep < 6) {
        this.tutorialStep++;
        this.showTutorialStep();
        return;
      }
      this.clearTutorial();
      this.invalidateStoneDisplay();
      this.render();
      this.boardLayer.tweener
        .clear()
        .to({ y: 0 }, 350, "easeOutQuad")
        .call(() => {
          this.tutorialActive = false;
          this.setMainButtonsVisible(true);
          this.setReplayNavVisible(false);
          this.msg.text = "自由に石を置こう！\nタップで白、長押しで黒です";
          this.updateButtons();
          this.openStageSelect(false);
        });
    },
    setMainButtonsVisible: function (visible) {
      [
        this.startButton,
        this.resetButton,
        this.replayButton,
        this.workButton,
      ].forEach((button) => {
        if (button) button.visible = visible;
      });
    },
    updateButtons: function () {
      if (!this.startButton || !this.resetButton || !this.replayButton) return;

      var editing =
        !this.tutorialActive &&
        this.canStart &&
        !this.running &&
        !this.replaying;
      var playing =
        !this.tutorialActive &&
        !this.running &&
        this.replaying &&
        !this.replayPaused;
      var paused =
        !this.tutorialActive &&
        !this.running &&
        this.replaying &&
        this.replayPaused;
      var result =
        !this.tutorialActive &&
        !this.running &&
        !this.replaying &&
        !this.canStart &&
        this.frames.length > 0;
      var calculating = !this.tutorialActive && this.running;

      var leftEnabled = editing || playing || paused || result;
      var leftText = "スタート";
      if (playing) leftText = "一時停止";
      else if (paused) leftText = "再開";
      else if (result) leftText = "リプレイ";
      this.startButton.fill = leftEnabled ? "#ef6c00" : "#777777";
      this.startButton.alpha = leftEnabled ? 1 : 0.55;
      this.startButton.setInteractive(leftEnabled);
      if (this.startButton.buttonLabel)
        this.startButton.buttonLabel.text = leftText;

      var editEnabled = (paused || result) && !!this.editBoard;
      this.resetButton.fill = editEnabled ? "#1976d2" : "#777777";
      this.resetButton.alpha = editEnabled ? 1 : 0.55;
      this.resetButton.setInteractive(editEnabled);
      if (this.resetButton.buttonLabel)
        this.resetButton.buttonLabel.text = "手直し";

      var clearEnabled = editing || paused || result;
      this.replayButton.fill = clearEnabled ? "#607d8b" : "#777777";
      this.replayButton.alpha = clearEnabled ? 1 : 0.55;
      this.replayButton.setInteractive(clearEnabled);
      if (this.replayButton.buttonLabel)
        this.replayButton.buttonLabel.text = "全消去";

      if (calculating) {
        this.startButton.setInteractive(false);
        this.resetButton.setInteractive(false);
        this.replayButton.setInteractive(false);
      }
      var workEnabled = !this.tutorialActive && !this.running;
      if (this.workButton) {
        this.workButton.alpha = workEnabled ? 1 : 0.45;
        this.workButton.setInteractive(workEnabled);
      }
      this.updateReplayCounter();
    },
    primaryAction: function () {
      if (this.tutorialActive || this.running) return;
      if (this.canStart) {
        this.start();
        return;
      }
      if (this.replaying) {
        if (this.replayPaused) {
          this.replayPaused = false;
          this.updateButtons();
          this.playFrame();
        } else {
          this.replayPaused = true;
          this.tweener.clear();
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
      this.reachedGoalKeys = Object.create(null);
      this.setReplayNavVisible(true);
      this.updateButtons();
      this.playFrame();
    },
    editAgain: function () {
      this.closeWorkMenu();
      if (this.running || !this.editBoard) return;
      // 再生中・一時停止中・一手送り/戻し中でも即座に編集へ戻る。
      this.tweener.clear();
      this.board = this.editBoard.clone();
      this.beforeEditCells = this.board.cells.slice();
      this.invalidateStoneDisplay();
      this.target = { x: TARGET.x, y: TARGET.y };
      this.turn = "white";
      this.running = false;
      this.replaying = false;
      this.replayPaused = false;
      this.canStart = true;
      this.previousRunMoves = this.runMoves.map((m) => ({
        color: m.color,
        x: m.x,
        y: m.y,
      }));
      this.compareAfterEdit = this.previousRunMoves.length > 0;
      this.frames = [];
      this.goalReached = false;
      this.reachedGoalKeys = Object.create(null);
      this.goalFadeAnimatingKey = null;
      this.piAnimating = false;
      this.replayCurrentIndex = -1;
      this.setReplayNavVisible(false);
      this.clearHints();
      this.last = null;
      this.msg.text = "石を手直しして、もう一回！";
      this.render();
      this.updateButtons();
    },
    drawBase: function () {
      RectangleShape({
        width: BP + 56,
        height: BP + 56,
        fill: "#E1B866",
        stroke: "#000",
        strokeWidth: 10,
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
      this.goalSprites = [];
      STAGES[3].goals.forEach((goal) => {
        var gp = pos(goal.x, goal.y);
        var circle = CircleShape({
          radius: 23,
          fill: "#ffff00",
          stroke: "#000",
          strokeWidth: 8,
        })
          .setPosition(gp.x, gp.y)
          .addChildTo(this.boardLayer);
        var label = Label({
          text: "Ｇ",
          fontSize: 24,
          fill: "#000",
          fontWeight: "bold",
        })
          .setPosition(gp.x, gp.y)
          .addChildTo(this.boardLayer);
        this.goalSprites.push({
          goal: { x: goal.x, y: goal.y },
          circle: circle,
          label: label,
        });
      });
      for (var y = 0; y < S; y++) {
        this.stoneSprites[y] = [];
        for (var x = 0; x < S; x++) {
          var p = pos(x, y);
          var stone = CircleShape({
            radius: 22,
            fill: "#151719",
            stroke: "#000",
            strokeWidth: 2,
          })
            .setPosition(p.x, p.y)
            .addChildTo(this.boardLayer);
          stone.visible = false;
          this.stoneSprites[y][x] = stone;
        }
      }
      this.lastMoveMarker = CircleShape({
        radius: 10,
        fill: "#fff",
        stroke: null,
      }).addChildTo(this.boardLayer);
      this.lastMoveMarker.visible = false;
      // 長押し中の着手点を指の外側から確認できる大きなリング。
      this.placementRing = CircleShape({
        radius: 100,
        fill: "transparent",
        stroke: "#ffffff",
        strokeWidth: 5,
      }).addChildTo(this.boardLayer);
      this.placementRing.visible = false;
      this.placementRing.alpha = 0.9;
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
        // 黒はその場を押さえる。位置は動かさない。
        sprite.scaleX = 1.25;
        sprite.scaleY = 1.25;
        sprite.tweener
          .to({ scaleX: 1, scaleY: 1 }, 100, "easeOutQuad")
          .call(() => {
            if (this.moveEffectKey === key) this.moveEffectKey = "";
          });
        setTimeout(() => {
          SoundManager.play("blackSound");
        }, 0);
      } else if (value === G.WHITE) {
        // 白は前の白石から現在の交点へ逃げ込む方向を見せる。
        // 本来の交点より進行方向の逆側から、6pxだけ滑り込ませる。
        var from = previousWhiteMove || { x: TARGET.x, y: TARGET.y };
        var dx = x - from.x;
        var dy = y - from.y;
        var length = Math.hypot(dx, dy);
        var distance = 30;
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
          // .wait(10)
          .to(
            {
              x: destination.x,
              y: destination.y,
              scaleX: 1.12,
              scaleY: 1.12,
            },
            150,
            "easeOutQuad",
          )
          .to({ scaleX: 1, scaleY: 1 }, 10, "easeOutQuad")
          .call(() => {
            // 次のフレームが始まる前に、必ず交点へ固定する。
            sprite.x = destination.x;
            sprite.y = destination.y;
            if (this.moveEffectKey === key) this.moveEffectKey = "";
          });
        setTimeout(() => {
          SoundManager.play("whiteSound");
        }, 0);
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
        var lastSprite = this.stoneSprites[this.last.y][this.last.x];

        if (
          lastSprite &&
          lastSprite.visible &&
          (lastValue === G.BLACK || lastValue === G.WHITE)
        ) {
          this.lastMoveMarker.x = lastSprite.x;
          this.lastMoveMarker.y = lastSprite.y;

          // 黒石には白点、白石には黒点
          this.lastMoveMarker.fill = lastValue === G.BLACK ? "#fff" : "#000";

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
      this.goalSprites.forEach((item) => {
        var key = this.goalKey(item.goal);
        var active = this.goals.some((goal) => this.goalKey(goal) === key);
        var reached = !!this.reachedGoalKeys[key];
        var animating = active && this.goalFadeAnimatingKey === key;
        if (!active) {
          item.circle.visible = false;
          item.label.visible = false;
          return;
        }
        if (!animating) {
          item.circle.tweener.clear();
          item.label.tweener.clear();
          item.circle.y = pos(item.goal.x, item.goal.y).y;
          item.label.y = pos(item.goal.x, item.goal.y).y;
          item.circle.scaleX = item.circle.scaleY = 1;
          item.label.scaleX = item.label.scaleY = 1;
          item.circle.alpha = 1;
          item.label.alpha = 1;
          item.circle.fill = "#ffff00";
          item.label.text = "Ｇ";
          item.circle.visible = !reached;
          item.label.visible = !reached;
        }
      });
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
            .addChildTo(this.boardLayer),
        );
        this.add(
          Label({
            text: "?",
            fontSize: 22,
            fill: "#5d4037",
            fontWeight: "bold",
          })
            .setPosition(p.x, p.y)
            .addChildTo(this.boardLayer),
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
            .addChildTo(this.boardLayer),
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
            .addChildTo(this.boardLayer),
        );
        this.add(
          Label({
            text: "!",
            fontSize: 24,
            fill: "#5d4037",
            fontWeight: "bold",
          })
            .setPosition(p.x, p.y)
            .addChildTo(this.boardLayer),
        );
      }

      // 通常の再描画では立った旗を表示。アニメーション時は別途生成する。
      if (!this.piAnimating) this.showPiFlag(false);
    },
    fixed: function (x, y) {
      return (
        this.goals.some((goal) => x === goal.x && y === goal.y) ||
        (x === TARGET.x && y === TARGET.y - 1) ||
        INIT.some((s) => s.x === x && s.y === y)
      );
    },
    goalKey: function (goal) {
      return goal.x + "," + goal.y;
    },
    remainingGoals: function () {
      return this.goals.filter(
        (goal) => !this.reachedGoalKeys[this.goalKey(goal)],
      );
    },
    markReachedGoals: function (goals) {
      (goals || []).forEach((goal) => {
        this.reachedGoalKeys[this.goalKey(goal)] = true;
      });
    },
    reachedGoalCount: function () {
      return this.goals.length - this.remainingGoals().length;
    },
    goalSpriteFor: function (goal) {
      var key = this.goalKey(goal);
      return (
        this.goalSprites.find((item) => this.goalKey(item.goal) === key) || null
      );
    },
    animatePassedGoal: function (goal) {
      var item = this.goalSpriteFor(goal);
      if (!item || this.goals.length <= 1) return;
      var key = this.goalKey(goal);
      this.goalFadeAnimatingKey = key;

      // 元のGは碁石より奥にあるため非表示にし、演出専用のコピーを
      // boardLayerの最後に追加する。これにより白石より手前で「ふわっ」と消える。
      item.circle.visible = false;
      item.label.visible = false;
      var gp = pos(goal.x, goal.y);
      var floatingCircle = CircleShape({
        radius: 23,
        fill: "#ffff00",
        stroke: "#000",
        strokeWidth: 8,
      })
        .setPosition(gp.x, gp.y)
        .addChildTo(this.boardLayer);
      var floatingLabel = Label({
        text: "Ｇ",
        fontSize: 24,
        fill: "#000",
        fontWeight: "bold",
      })
        .setPosition(gp.x, gp.y)
        .addChildTo(this.boardLayer);

      var finished = 0;
      var finishOne = (sprite) => {
        sprite.remove();
        finished++;
        if (finished === 2 && this.goalFadeAnimatingKey === key) {
          this.goalFadeAnimatingKey = null;
        }
      };

      [floatingCircle, floatingLabel].forEach((sprite) => {
        sprite.tweener
          .clear()
          .to(
            {
              y: gp.y - 45,
              alpha: 0,
              scaleX: 1.18,
              scaleY: 1.18,
            },
            420,
            "easeOutQuad",
          )
          .call(() => finishOne(sprite));
      });
    },
    clearHints: function () {
      this.branchMarkers = [];
      this.captureMoves = [];
      this.captureStones = [];
    },
    editablePointAt: function (px, py) {
      if (
        this.running ||
        this.replaying ||
        !this.canStart ||
        py < T - C / 2 ||
        py > T + BP + C / 2 ||
        px < L - C / 2 ||
        px > L + BP + C / 2
      )
        return null;
      var x = Math.round((px - L) / C),
        y = Math.round((py - T) / C);
      if (this.fixed(x, y)) return null;
      var p = pos(x, y);
      if (Math.hypot(px - p.x, py - p.y) > C * 0.45) return null;
      return { x: x, y: y, p: p, value: this.board.get(x, y) };
    },
    beginPlacementPress: function (px, py) {
      var hit = this.editablePointAt(px, py);
      if (!hit) return;

      // 既存石は従来より単純に、タップで削除する。
      if (hit.value === G.BLACK || hit.value === G.WHITE) {
        this.placePress = {
          x: hit.x,
          y: hit.y,
          startX: px,
          startY: py,
          originalValue: hit.value,
          existingStone: true,
          canceled: false,
        };
        return;
      }

      // 空点では押した瞬間に白石を仮表示する。
      this.board.set(hit.x, hit.y, G.WHITE);
      this.frames = [];
      this.clearHints();
      this.render();
      this.placementRing.x = hit.p.x;
      this.placementRing.y = hit.p.y;
      this.placementRing.stroke = "#ffffff";
      this.placementRing.strokeWidth = 7;
      this.placementRing.scaleX = 0.85;
      this.placementRing.scaleY = 0.85;
      this.placementRing.alpha = 0.9;
      this.placementRing.visible = true;
      this.placementRing.tweener
        .clear()
        .to({ scaleX: 1.05, scaleY: 1.05 }, this.placePressThreshold, "linear");
      setTimeout(() => SoundManager.play("blackSound"), 0);

      var press = {
        x: hit.x,
        y: hit.y,
        startX: px,
        startY: py,
        originalValue: G.EMPTY,
        existingStone: false,
        becameBlack: false,
        canceled: false,
        timer: null,
      };
      this.placePress = press;
      press.timer = setTimeout(() => {
        if (this.placePress !== press || press.canceled) return;
        press.becameBlack = true;
        this.board.set(press.x, press.y, G.BLACK);
        var sprite = this.stoneSprites[press.y][press.x];
        if (sprite) {
          sprite.fill = "#151719";
          sprite.stroke = "#000";
          sprite.strokeWidth = 2;
          sprite.visible = true;
        }
        this.displayedCells[press.y * S + press.x] = G.BLACK;
        this.placementRing.stroke = "#151719";
        this.placementRing.strokeWidth = 7;
        this.placementRing.tweener.clear();
        this.placementRing.scaleX = 1.18;
        this.placementRing.scaleY = 1.18;
        this.placementRing.tweener.to(
          { scaleX: 1, scaleY: 1 },
          100,
          "easeOutQuad",
        );
        setTimeout(() => SoundManager.play("blackSound"), 0);
      }, this.placePressThreshold);
    },
    movePlacementPress: function (px, py) {
      var press = this.placePress;
      if (!press || press.canceled) return;
      if (
        Math.hypot(px - press.startX, py - press.startY) <=
        this.placePressCancelDistance
      )
        return;
      press.canceled = true;
      if (press.timer) {
        clearTimeout(press.timer);
        press.timer = null;
      }
      this.placementRing.tweener.clear();
      this.placementRing.visible = false;
      // 指を大きくずらした場合は、空点なら仮石を元へ戻してキャンセル。
      if (!press.existingStone) {
        this.board.set(press.x, press.y, G.EMPTY);
        this.invalidateStoneDisplay();
        this.render();
      }
    },
    endPlacementPress: function (px, py) {
      var press = this.placePress;
      if (!press) return;
      this.placePress = null;
      if (press.timer) clearTimeout(press.timer);
      this.placementRing.tweener.clear();
      this.placementRing.visible = false;
      if (press.canceled) return;

      if (press.existingStone) {
        // 既存石は短いクリック/タップで削除。ドラッグならmove側でキャンセル済み。
        this.board.set(press.x, press.y, G.EMPTY);
      } else if (!press.becameBlack) {
        // 280ms未満なら白で確定。
        this.board.set(press.x, press.y, G.WHITE);
      }
      this.frames = [];
      this.clearHints();
      this.invalidateStoneDisplay();
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
        reachedGoalKeys: Object.assign({}, this.reachedGoalKeys),
        text: text,
      });
    },
    recordRunMove: function (color, move) {
      if (move) this.runMoves.push({ color: color, x: move.x, y: move.y });
    },
    commonMoveCount: function (a, b) {
      if (!a || !b) return 0;
      var i = 0,
        n = Math.min(a.length, b.length);
      while (
        i < n &&
        a[i].color === b[i].color &&
        a[i].x === b[i].x &&
        a[i].y === b[i].y
      )
        i++;
      return i;
    },
    boardsAreSame: function (a, b) {
      if (!a || !b || a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    },
    replayStartIndexAfterEdit: function () {
      if (!this.compareAfterEdit || !this.previousRunMoves) return 0;
      if (
        this.beforeEditCells &&
        this.editBoard &&
        this.boardsAreSame(this.beforeEditCells, this.editBoard.cells)
      ) {
        console.debug("[Replay] 盤面変更なし → 最初から再生");
        return 0;
      }
      var common = this.commonMoveCount(this.previousRunMoves, this.runMoves);
      var index = Math.max(0, common - 6);
      console.debug("[Replay] 手直し前後の比較", {
        previousMoves: this.previousRunMoves.length,
        currentMoves: this.runMoves.length,
        commonMoves: common,
        replayStartIndex: index,
      });
      return Math.min(index, Math.max(0, this.frames.length - 1));
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
      this.runMoves = [];
      this.simulationResult = null;
      this.goalReached = false;
      this.reachedGoalKeys = Object.create(null);
      this.goalFadeAnimatingKey = null;
      this.piAnimating = false;
      this.replayCurrentIndex = -1;
      this.setReplayNavVisible(true);
      this.clearHints();
      this.msg.text = "考え中…";
      this.render();
      this.updateButtons();

      // メッセージを一度描画してから、同期的に最終結果まで計算する。
      this.tweener
        .clear()
        .wait(30)
        .call(() => this.calculateAll());
    },
    collectCaptureHints: function (r) {
      this.clearHints();
      var stoneSeen = Object.create(null),
        moveSeen = Object.create(null);
      for (var c of r.captures || []) {
        var mk = c.move.x + "," + c.move.y;
        if (!moveSeen[mk]) {
          moveSeen[mk] = true;
          this.captureMoves.push({ x: c.move.x, y: c.move.y });
        }
        for (var stone of c.group.stones) {
          var sk = stone.x + "," + stone.y;
          if (!stoneSeen[sk]) {
            stoneSeen[sk] = true;
            this.captureStones.push({ x: stone.x, y: stone.y });
          }
        }
      }
    },
    blackCanCaptureTargetImmediately: function () {
      var targetGroup = this.board.groupAt(this.target.x, this.target.y);
      if (!targetGroup || targetGroup.color !== G.WHITE) return false;

      // playableフラグには依存せず、実際の気すべてへ黒を仮着手する。
      // play()が合法性と捕獲を確定し、capturedに対象白石が含まれるかで判定する。
      var targetKeys = Object.create(null);
      targetGroup.stones.forEach((stone) => {
        targetKeys[stone.x + "," + stone.y] = true;
      });

      for (var liberty of targetGroup.liberties) {
        var result = this.board.play(liberty.x, liberty.y, G.BLACK);
        if (!result) continue;
        var capturedTarget = (result.captured || []).some(
          (stone) => targetKeys[stone.x + "," + stone.y],
        );
        if (capturedTarget) {
          console.debug("[Ladder] 黒の即時捕獲を着手前に検出", {
            move: { x: liberty.x, y: liberty.y },
            captured: result.captured.length,
          });
          return true;
        }
      }
      return false;
    },
    calculateAll: function () {
      this.board = this.normal();
      this.invalidateStoneDisplay();
      this.target = { x: TARGET.x, y: TARGET.y };
      this.turn = "white";
      this.moveCount = 1;
      this.last = null;
      this.clearHints();
      this.save("スタート！");

      var maxMoves = S * S * 4;
      var resultText = "読みが長すぎる…";
      var success = false;

      for (var i = 0; i < maxMoves; i++) {
        var engine = new G.LadderEngine(
          this.board,
          this.target,
          this.remainingGoals(),
        );
        var r;

        if (this.turn === "white") {
          r = engine.stepWhite();
          if (r.status === "goal") {
            if (r.board) {
              this.board = r.board;
              this.target = r.target || this.target;
              this.moveCount++;
              this.recordRunMove(G.WHITE, r.move);
            }
            this.last = r.move || this.last;
            this.markReachedGoals(r.goals);
            this.clearHints();
            var reachedCount = this.reachedGoalCount();
            if (reachedCount >= this.goals.length) {
              resultText = "ゴール！（" + this.moveCount + "手）";
              this.goalReached = true;
              this.save(resultText);
              success = true;
              break;
            }
            this.turn = "black";
            this.save(
              "Ｇ通過！（" + reachedCount + " / " + this.goals.length + "）",
            );
            continue;
          }
          if (r.status === "white-branch" && r.board) {
            this.board = r.board;
            this.target = r.target;
            this.last = r.move;
            this.moveCount++;
            this.recordRunMove(G.WHITE, r.move);
            this.clearHints();
            this.save("白が逃げる");
            var explanation = new G.LadderEngine(
              this.board,
              this.target,
              this.remainingGoals(),
            ).explainBranch(this.board, this.target);
            if (explanation) {
              this.board = explanation.board;
              this.last = explanation.move;
              this.branchMarkers = explanation.liberties;
              this.recordRunMove(G.BLACK, explanation.move);
              resultText =
                "白の逃げ道が" +
                explanation.liberties.length +
                "つある！\n残念…";
              this.save(resultText);
            } else {
              var group = this.board.groupAt(this.target.x, this.target.y);
              this.branchMarkers = this.board.playableLiberties(group);
              resultText =
                "白の逃げ道が" + this.branchMarkers.length + "つある！\n残念…";
              this.save(resultText);
            }
            break;
          }
          if (r.status === "white-branch") {
            this.clearHints();
            this.branchMarkers = r.liberties || [];
            resultText = "白の逃げ道が" + r.count + "つある！\n残念…";
            this.save(resultText);
            break;
          }
          if (r.status === "white-can-capture") {
            this.collectCaptureHints(r);
            resultText = "黒石が取られてしまう！\n残念…";
            this.save(resultText);
            break;
          }
          if (r.status !== "ok") {
            resultText =
              {
                obstacle: "シチョウが続かない！\n残念…",
                "no-escape": "白はもう逃げられない！\n残念…",
                captured: "白はもう逃げられない！\n残念…",
                illegal: "白はそこに打てない！\n残念…",
              }[r.status] || "白が止まった！\n残念…";
            this.save(resultText);
            break;
          }
          this.board = r.board;
          this.target = r.target;
          this.turn = "black";
          this.last = r.move;
          this.moveCount++;
          this.recordRunMove(G.WHITE, r.move);
          this.clearHints();
          this.save("白が逃げる");
        } else {
          // 黒の次の1手で対象白一団が取られるなら、捕獲手を盤面へ反映する前に終了。
          if (this.blackCanCaptureTargetImmediately()) {
            resultText = "白はもう逃げられない！\n残念…";
            this.save(resultText);
            break;
          }
          r = engine.chooseBlack();
          if (r.status !== "ok") {
            resultText = "黒はアタリを続けられない！\n残念…";
            this.save(resultText);
            break;
          }
          if (r.immediateCapture) {
            // 次の黒手で白の捕獲が確定。白石を実際に消す前の盤面で終了する。
            resultText = "白はもう逃げられない！\n残念…";
            this.save(resultText);
            break;
          }
          this.board = r.board;
          this.target = r.target;
          this.turn = "white";
          this.last = r.move;
          this.moveCount++;
          this.recordRunMove(G.BLACK, r.move);
          this.clearHints();
          this.save("黒が追う");
        }
      }

      this.simulationResult = { text: resultText, success: success };
      this.running = false;
      this.replaying = true;
      this.replayPaused = false;
      var replayStart = this.replayStartIndexAfterEdit();
      this.fi = replayStart;
      this.replayCurrentIndex = replayStart - 1;
      this.previousRunMoves = this.runMoves.map((m) => ({
        color: m.color,
        x: m.x,
        y: m.y,
      }));
      this.compareAfterEdit = false;
      this.beforeEditCells = null;
      this.updateButtons();
      this.playFrame();
    },
    showPiFlag: function (animate) {
      if (!this.goalReached || !this.last) return;

      var gp = pos(this.last.x, this.last.y);
      var flag = Sprite("pi")
        // 左下を白石中央に合わせ、回転支点にもする。
        .setOrigin(0, 1)
        .setPosition(gp.x, gp.y)
        .addChildTo(this.boardLayer);

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
      var center = pos(this.last.x, this.last.y);
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
        })
          .setPosition(center.x, center.y)
          .addChildTo(this.boardLayer);
        this.add(particle);

        particle.tweener
          .clear()
          .to(
            {
              x: center.x + Math.cos(angle) * distance,
              y: center.y + Math.sin(angle) * distance,
            },
            800,
            "easeOutQuad",
          )
          .to(
            {
              alpha: 0,
              scaleX: 0.5,
              scaleY: 0.5,
            },
            350,
            "easeOutQuad",
          )
          .call(() => particle.remove());
      }

      // ゴール地点から黄色いリングを1回だけ広げる。
      var ring = CircleShape({
        radius: 24,
        fill: "transparent",
        stroke: "#ffd600",
        strokeWidth: 6,
      })
        .setPosition(center.x, center.y)
        .addChildTo(this.boardLayer);
      this.add(ring);
      ring.tweener
        .clear()
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
      this.tweener
        .clear()
        .wait(this.playbackInterval)
        .call(() => this.playFrame());
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
      this.runMoves = [];
      this.previousRunMoves = null;
      this.compareAfterEdit = false;
      this.beforeEditCells = null;
      this.simulationResult = null;
      this.goalReached = false;
      this.reachedGoalKeys = Object.create(null);
      this.goalFadeAnimatingKey = null;
      this.piAnimating = false;
      this.replayCurrentIndex = -1;
      this.setReplayNavVisible(false);
      this.clearHints();
      this.last = null;
      this.msg.text = "自由に石を置こう！\nタップで白、長押しで黒です";
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
          pi: "pi.png",
          arrow: "arrow.png",
        },
        sound: {
          blackSound: "black.mp3",
          whiteSound: "white.mp3",
          goalSound: "goal.mp3",
          failSound: "failed.mp3",
          pointSound: "point.mp3",
        },
      },
    }).run();
  });
})();
