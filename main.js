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
    GOAL = { x: 11, y: 11 };
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
      stroke: "#fff",
      strokeWidth: 6,
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
      this.backgroundColor = "#00B050";

    // タイトル画像
    var titleLogo = Sprite("titleLogo")
      .addChildTo(this)
      .setPosition(W / 2, 400);

    var targetWidth = 600;
    var scale = targetWidth / titleLogo.width;
    titleLogo.setScale(scale);

    Sprite("neko1").addChildTo(this).setPosition(W / 2, 630);
      
      btn(this, W / 2, 755, 330, "あそぶ", "#ef6c00", () => this.exit("main"));
      Label({
        text: "シチョウで、白石をゴールまで導こう！\n注意：白の逃げ道が複数ある場合は失敗です",
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
      this.backgroundColor = "#00B050";
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
      this.base = DisplayElement().addChildTo(this);
      this.drawBase();
      this.msg = Label({
        text: "",
        fontSize: 30,
        fill: "#fff",
        lineHeight: 1.35,
      })
        .setPosition(400, MY)
        .addChildTo(this);
      this.catSprite = Sprite("neko1").addChildTo(this).setPosition(82, MY);
      this.startButton = btn(this, 150, BY, 190, "スタート", "#ef6c00", () => this.primaryAction());
      this.resetButton = btn(this, 360, BY, 170, "全消去", "#607d8b", () => this.reset());
      this.replayButton = btn(this, 570, BY, 170, "再生", "#1976d2", () => this.replay());
      this.prevReplayButton = btn(this, 255, BY + 92, 84, "◀", "#455a64", () => this.stepReplay(-1));
      this.nextReplayButton = btn(this, 465, BY + 92, 84, "▶", "#455a64", () => this.stepReplay(1));
      this.replayCounter = Label({ text: "0 / 0", fontSize: 24, fill: "#fff", fontWeight: "bold" }).setPosition(360, BY + 92).addChildTo(this);
      this.setReplayNavVisible(false);
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
    setReplayNavVisible: function (visible) {
      this.replayNavVisible = visible;
      if (this.prevReplayButton) this.prevReplayButton.visible = visible;
      if (this.nextReplayButton) this.nextReplayButton.visible = visible;
      if (this.replayCounter) this.replayCounter.visible = visible;
    },
    updateReplayCounter: function () {
      if (!this.replayCounter) return;
      var total = this.frames.length;
      var current = this.replayCurrentIndex >= 0 ? this.replayCurrentIndex + 1 : 0;
      this.replayCounter.text = current + " / " + total;
      var prevEnabled = this.replayNavVisible && current > 1;
      var nextEnabled = this.replayNavVisible && current < total;
      if (this.prevReplayButton) { this.prevReplayButton.fill = prevEnabled ? "#455a64" : "#777777"; this.prevReplayButton.alpha = prevEnabled ? 1 : 0.45; this.prevReplayButton.setInteractive(prevEnabled); }
      if (this.nextReplayButton) { this.nextReplayButton.fill = nextEnabled ? "#455a64" : "#777777"; this.nextReplayButton.alpha = nextEnabled ? 1 : 0.45; this.nextReplayButton.setInteractive(nextEnabled); }
    },
    showReplayFrame: function (index) {
      if (!this.frames.length) return;
      index = Math.max(0, Math.min(this.frames.length - 1, index));
      var f = this.frames[index];
      this.replayCurrentIndex = index;
      this.fi = index + 1;
      this.board = new G.GoBoard(S, f.cells); this.last = f.last;
      this.branchMarkers = f.branchMarkers || []; this.captureMoves = f.captureMoves || []; this.captureStones = f.captureStones || [];
      this.msg.text = "再生中：" + f.text;
      if (f.text === "成功") this.showHappyCat();
      else if (index === this.frames.length - 1 && f.text !== "成功") this.showSadCat();
      else { var n = 0; for (var i=0;i<=index;i++){var t=this.frames[i].text;if(t === "白が逃げました" || t === "黒がアタリ") n++;} this.catFrame = n % 2 === 0 ? 1 : 2; this.setCat(this.catFrame === 1 ? "neko1" : "neko2"); }
      this.render(); this.updateReplayCounter();
    },
    stepReplay: function (delta) {
      if (!this.frames.length || !this.replayNavVisible) return;
      this.replaying = true; this.replayPaused = true; this.tweener.clear();
      var base = this.replayCurrentIndex >= 0 ? this.replayCurrentIndex : 0;
      this.showReplayFrame(base + delta); this.updateButtons();
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
    showHappyCat: function () { this.setCat("neko3"); },
    showSadCat: function () { this.setCat("neko4"); },
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
      var shade = RectangleShape({ width: width, height: height, fill: "#000", stroke: "transparent" })
        .setPosition(x, y).addChildTo(this);
      shade.alpha = alpha;
      this.addTutorial(shade);
    },
    addSpotlightCurtains: function (holeX, holeY, holeWidth, holeHeight) {
      var boardLeft = L - 28, boardTop = T - 28;
      var boardRight = L + BP + 28, boardBottom = T + BP + 28;
      var holeLeft = Math.max(boardLeft, holeX - holeWidth / 2);
      var holeTop = Math.max(boardTop, holeY - holeHeight / 2);
      var holeRight = Math.min(boardRight, holeX + holeWidth / 2);
      var holeBottom = Math.min(boardBottom, holeY + holeHeight / 2);
      var alpha = 0.5;
      this.addTutorialShade((boardLeft + boardRight) / 2, (boardTop + holeTop) / 2, boardRight - boardLeft, holeTop - boardTop, alpha);
      this.addTutorialShade((boardLeft + boardRight) / 2, (holeBottom + boardBottom) / 2, boardRight - boardLeft, boardBottom - holeBottom, alpha);
      this.addTutorialShade((boardLeft + holeLeft) / 2, (holeTop + holeBottom) / 2, holeLeft - boardLeft, holeBottom - holeTop, alpha);
      this.addTutorialShade((holeRight + boardRight) / 2, (holeTop + holeBottom) / 2, boardRight - holeRight, holeBottom - holeTop, alpha);
      return { width: holeRight - holeLeft, height: holeBottom - holeTop, centerX: (holeLeft + holeRight) / 2, centerY: (holeTop + holeBottom) / 2 };
    },
    showTutorialStep: function () {
      this.clearTutorial();
      if (!this.tutorialActive) return;
      var text = "", textX = W / 2, textY = T + BP / 2, hole = null;
      if (this.tutorialStep === 1) {
        var startP = pos(TARGET.x, TARGET.y);
        hole = this.addSpotlightCurtains(startP.x - C * 0.45, startP.y, C * 3.25, C * 3.2);
        text = "1/3\nここからシチョウがスタート！\n白が逃げます";
      } else if (this.tutorialStep === 2) {
        var goalP = pos(GOAL.x, GOAL.y);
        hole = this.addSpotlightCurtains(goalP.x, goalP.y, C * 2.2, C * 2.2);
        text = "2/3\n白が「ピ」まで来たらゴール！";
      } else {
        text = "3/3\n石を置いて、\n白を「ピ」へ導こう！";
      }
      if (hole) {
        var frame = this.tutorialStep === 1
          ? RectangleShape({ width: hole.width, height: hole.height, cornerRadius: 34, fill: "transparent", stroke: "#ffd54f", strokeWidth: 5 })
          : CircleShape({ radius: Math.min(hole.width, hole.height) / 2, fill: "transparent", stroke: "#ffd54f", strokeWidth: 5 });
        this.addTutorial(frame.setPosition(hole.centerX, hole.centerY).addChildTo(this));
      }
      var uiTop = T + BP + 28;
      this.addTutorialShade(W / 2, (uiTop + H) / 2, W, H - uiTop, 0.76);
      this.addTutorial(Label({ text: text, fontSize: 34, fill: "#fff", fontWeight: "bold", lineHeight: 1.35, stroke: "rgba(0,0,0,0.68)", strokeWidth: 6, align: "center" }).setPosition(textX, textY).addChildTo(this));
      this.addTutorial(Label({ text: this.tutorialStep < 3 ? "タップして次へ" : "タップしてはじめる", fontSize: 22, fill: "rgba(255,255,255,0.66)", fontWeight: "bold" }).setPosition(W / 2, H - 450).addChildTo(this));
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
      this.msg.text = "空点タップ：白 → 黒 → 空";
      this.updateButtons();
    },
    updateButtons: function () {
      if (!this.startButton || !this.replayButton) return;

      var editing = !this.tutorialActive && this.canStart && !this.running && !this.replaying;
      var canEditAgain = !this.tutorialActive && !this.canStart && !this.running && !this.replaying && !!this.editBoard;
      var primaryEnabled = editing || canEditAgain;
      var replayEnabled = !this.tutorialActive && !this.running && this.frames.length > 0;

      this.startButton.fill = primaryEnabled ? "#ef6c00" : "#777777";
      this.startButton.alpha = primaryEnabled ? 1.0 : 0.55;
      this.startButton.setInteractive(primaryEnabled);
      if (this.startButton.buttonLabel) {
        this.startButton.buttonLabel.text = canEditAgain ? "手直し" : "スタート";
      }

      this.replayButton.fill = replayEnabled ? "#1976d2" : "#777777";
      this.replayButton.alpha = replayEnabled ? 1.0 : 0.55;
      this.replayButton.setInteractive(replayEnabled);
      if (this.replayButton.buttonLabel) {
        this.replayButton.buttonLabel.text = this.replaying
          ? (this.replayPaused ? "再開" : "一時停止")
          : "再生";
      }
      this.updateReplayCounter();
    },
    primaryAction: function () {
      if (this.canStart) this.start();
      else this.editAgain();
    },
    editAgain: function () {
      if (this.running || this.replaying || !this.editBoard) return;
      this.tweener.clear();
      this.board = this.editBoard.clone();
      this.target = { x: TARGET.x, y: TARGET.y };
      this.turn = "white";
      this.running = false;
      this.replaying = false;
      this.replayPaused = false;
      this.canStart = true;
      this.frames = [];
      this.replayCurrentIndex = -1;
      this.setReplayNavVisible(false);
      this.clearHints();
      this.last = null;
      this.resetCat();
      this.msg.text = "石を手直しして、もう一度スタート";
      this.render();
      this.updateButtons();
    },
    drawBase: function () {
      RectangleShape({
        width: BP + 56,
        height: BP + 56,
        fill: "#d9ad5f",
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
    clear: function () {
      this.objects.forEach((o) => o.remove());
      this.objects = [];
    },
    add: function (o) {
      this.objects.push(o);
    },
    render: function () {
      this.clear();
      var p = pos(GOAL.x, GOAL.y);
      this.add(
        CircleShape({
          radius: 23,
          fill: "#ffd600",
          stroke: "#fff",
          strokeWidth: 5,
        })
          .setPosition(p.x, p.y)
          .addChildTo(this),
      );
      this.add(
        Label({ text: "ピ", fontSize: 24, fill: "#000", fontWeight: "bold" })
          .setPosition(p.x, p.y)
          .addChildTo(this),
      );
      for (var y = 0; y < S; y++)
        for (var x = 0; x < S; x++) {
          var c = this.board.get(x, y);
          if (c !== G.BLACK && c !== G.WHITE) continue;
          p = pos(x, y);
          var hi = this.last && this.last.x === x && this.last.y === y;
          this.add(
            CircleShape({
              radius: 22,
              fill: c === G.BLACK ? "#151719" : "#f8f4e8",
              stroke: hi ? "#ff5252" : c === G.BLACK ? "#000" : "#aaa",
              strokeWidth: hi ? 5 : 2,
            })
              .setPosition(p.x, p.y)
              .addChildTo(this),
          );
        }
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
      if (this.running || this.replaying || !this.canStart) return;
      // プレイヤーが配置した盤面を、手直し用に保存する。
      this.editBoard = this.board.clone();
      this.canStart = false;
      this.board = this.normal();
      this.target = { x: TARGET.x, y: TARGET.y };
      this.turn = "white";
      this.running = true;
      this.moveCount = 1;
      this.frames = [];
      this.resetCat();
      this.updateButtons();
      this.clearHints();
      this.save("シチョウ開始");
      this.render();
      this.next();
    },
    next: function () {
      this.tweener
        .clear()
        .wait(330)
        .call(() => this.advance());
    },
    showCaptureFailure: function (r) {
      this.clearHints();
      var stoneSeen = Object.create(null),
        moveSeen = Object.create(null);
      for (var c of r.captures || []) {
        var mk = c.move.x + "," + c.move.y;
        if (!moveSeen[mk]) {
          moveSeen[mk] = true;
          this.captureMoves.push({ x: c.move.x, y: c.move.y });
        }
        for (var s of c.group.stones) {
          var sk = s.x + "," + s.y;
          if (!stoneSeen[sk]) {
            stoneSeen[sk] = true;
            this.captureStones.push({ x: s.x, y: s.y });
          }
        }
      }
      this.save("白が黒石を取れる");
      this.finish("失敗：赤枠の黒石を取る手があります", "capture");
    },
    advance: function () {
      if (!this.running) return;
      var e = new G.LadderEngine(this.board, this.target, GOAL),
        r;
      if (this.turn === "white") {
        r = e.stepWhite();
        if (r.status === "goal") {
          if (r.board) {
            this.board = r.board;
            this.moveCount++;
          }
          this.last = r.move || this.last;
          this.save("成功");
          this.finish("成功！（" + this.moveCount + "手）");
          this.showGoalEffect();
          return;
        }
        if (r.status === "white-branch" && r.board) {
          this.board = r.board;
          this.target = r.target;
          this.last = r.move;
          this.moveCount++;
          this.clearHints();
          this.toggleCat();
          this.msg.text = "白が逃げました";
          this.save("白が逃げました");
          this.render();
          this.tweener
            .clear()
            .wait(400)
            .call(() => this.showBranchAfterBlack());
          return;
        }
        if (r.status === "white-branch") {
          this.clearHints();
          this.branchMarkers = r.liberties || [];
          this.save("白の逃げ道が複数");
          this.finish("失敗：白の逃げ道が" + r.count + "つあります", "branch");
          return;
        }
        if (r.status === "white-can-capture") {
          this.showCaptureFailure(r);
          return;
        }
        if (r.status !== "ok") {
          var m =
            {
              obstacle: "障害物でシチョウが成立しなくなりました",
              "no-escape": "白石が逃げられません",
              captured: "白石が逃げられません",
              illegal: "白の着手ができません",
            }[r.status] || "白の進行が止まりました";
          this.finish("失敗：" + m);
          return;
        }
        this.board = r.board;
        this.target = r.target;
        this.turn = "black";
        this.last = r.move;
        this.moveCount++;
        this.toggleCat();
        this.save("白が逃げました");
        this.msg.text = "白が逃げました";
      } else {
        r = e.chooseBlack();
        if (r.status !== "ok") {
          this.finish("失敗：黒がアタリを継続できません");
          return;
        }
        this.board = r.board;
        this.target = r.target;
        this.turn = "white";
        this.last = r.move;
        this.moveCount++;
        this.toggleCat();
        this.save("黒がアタリ");
        this.msg.text = "黒がアタリ";
      }
      this.render();
      this.next();
    },
    showBranchAfterBlack: function () {
      var e = new G.LadderEngine(this.board, this.target, GOAL),
        x = e.explainBranch(this.board, this.target);
      this.clearHints();
      if (x) {
        this.board = x.board;
        this.last = x.move;
        this.branchMarkers = x.liberties;
        this.save("黒が追い、逃げ道を表示");
        this.finish(
          "失敗：白の逃げ道が" + x.liberties.length + "つあります",
          "branch",
        );
      } else {
        var g = this.board.groupAt(this.target.x, this.target.y);
        this.branchMarkers = this.board.playableLiberties(g);
        this.save("逃げ道を表示");
        this.finish(
          "失敗：白の逃げ道が" + this.branchMarkers.length + "つあります",
          "branch",
        );
      }
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
      if (text.indexOf("成功") === 0) this.showHappyCat();
      else this.showSadCat();
      this.msg.text = text;
      this.render();
      this.updateButtons();
    },
    replay: function () {
      if (this.running || !this.frames.length) return;
      if (!this.replaying) {
        this.replaying = true;
        this.replayPaused = false;
        this.fi = 0;
        this.replayCurrentIndex = -1;
        this.setReplayNavVisible(true);
        this.resetCat();
        this.updateButtons();
        this.playFrame();
        return;
      }
      if (!this.replayPaused) {
        this.replayPaused = true;
        this.tweener.clear();
        this.msg.text = "一時停止中";
        this.updateButtons();
        return;
      }
      this.replayPaused = false;
      this.updateButtons();
      this.playFrame();
    },
    playFrame: function () {
      if (!this.replaying || this.replayPaused) return;
      if (this.fi >= this.frames.length) { this.replaying = false; this.replayPaused = false; this.msg.text = "再生終了"; this.updateButtons(); return; }
      this.showReplayFrame(this.fi);
      this.tweener.clear().wait(150).call(() => this.playFrame());
    },
    reset: function () {
      this.tweener.clear();
      this.board = newBoard();
      this.target = { x: TARGET.x, y: TARGET.y };
      this.running = false;
      this.replaying = false;
      this.replayPaused = false;
      this.canStart = true;
      this.editBoard = null;
      this.frames = [];
      this.replayCurrentIndex = -1;
      this.setReplayNavVisible(false);
      this.clearHints();
      this.last = null;
      this.resetCat();
      this.msg.text =
        "空点タップ：白 → 黒 → 空";
      this.render();
      this.updateButtons();
    },
  });
  phina.main(function () {
    GameApp({ startLabel: "title", width: W, height: H, fit: true,
    assets: {
      image: {
        titleLogo: "title.png",
        neko1: "neko1.png",
        neko2: "neko2.png",
        neko3: "neko3.png",
        neko4: "neko4.png",
      },
    },
    }).run();
  });
})();
