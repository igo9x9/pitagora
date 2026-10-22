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
    MY = 735,
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
      this.objects = [];
      this.frames = [];
      this.branchMarkers = [];
      this.captureMoves = [];
      this.captureStones = [];
      this.last = null;
      this.base = DisplayElement().addChildTo(this);
      this.drawBase();
      this.msg = Label({
        text: "空点タップ：白 → 黒 → 空\n石を置いて、右下の「ピ」へ",
        fontSize: 30,
        fill: "#fff",
        lineHeight: 1.35,
      })
        .setPosition(W / 2, MY)
        .addChildTo(this);
      this.startButton = btn(this, 150, BY, 190, "スタート", "#ef6c00", () => this.start());
      this.resetButton = btn(this, 360, BY, 170, "リセット", "#607d8b", () => this.reset());
      this.replayButton = btn(this, 570, BY, 170, "再生", "#1976d2", () => this.replay());
      this.updateButtons();
      this.onpointstart = (e) => this.tap(e.pointer.x, e.pointer.y);
      this.render();
    },
    updateButtons: function () {
      if (!this.startButton || !this.replayButton) return;
      var startEnabled = this.canStart && !this.running && !this.replaying;
      var replayEnabled = !this.running && this.frames.length > 0;
      this.startButton.fill = startEnabled ? "#ef6c00" : "#777777";
      this.startButton.alpha = startEnabled ? 1.0 : 0.55;
      this.startButton.setInteractive(startEnabled);
      this.replayButton.fill = replayEnabled ? "#1976d2" : "#777777";
      this.replayButton.alpha = replayEnabled ? 1.0 : 0.55;
      this.replayButton.setInteractive(replayEnabled);
      if (this.replayButton.buttonLabel) {
        this.replayButton.buttonLabel.text = this.replaying
          ? (this.replayPaused ? "再開" : "一時停止")
          : "再生";
      }
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
      this.canStart = false;
      this.board = this.normal();
      this.target = { x: TARGET.x, y: TARGET.y };
      this.turn = "white";
      this.running = true;
      this.moveCount = 1;
      this.frames = [];
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
      if (hintType === "branch")
        this.msg.text = text + "\n黄色が白の逃げ道です";
      else if (hintType === "capture")
        this.msg.text = text + "\n赤枠が取れる黒石、黄色が取りの着手点です";
      else this.msg.text = text;
      this.render();
      this.updateButtons();
    },
    replay: function () {
      if (this.running || !this.frames.length) return;
      if (!this.replaying) {
        this.replaying = true;
        this.replayPaused = false;
        this.fi = 0;
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
      if (this.fi >= this.frames.length) {
        this.replaying = false;
        this.replayPaused = false;
        this.msg.text = "再生終了";
        this.updateButtons();
        return;
      }
      var f = this.frames[this.fi++];
      this.board = new G.GoBoard(S, f.cells);
      this.last = f.last;
      this.branchMarkers = f.branchMarkers || [];
      this.captureMoves = f.captureMoves || [];
      this.captureStones = f.captureStones || [];
      this.msg.text = "再生中：" + f.text;
      this.render();
      this.tweener
        .clear()
        .wait(150)
        .call(() => this.playFrame());
    },
    reset: function () {
      this.tweener.clear();
      this.board = newBoard();
      this.target = { x: TARGET.x, y: TARGET.y };
      this.running = false;
      this.replaying = false;
      this.replayPaused = false;
      this.canStart = true;
      this.frames = [];
      this.clearHints();
      this.last = null;
      this.msg.text =
        "空点タップ：白 → 黒 → 空\n石を置いて、右下の「ピ」へ";
      this.render();
      this.updateButtons();
    },
  });
  phina.main(function () {
    GameApp({ startLabel: "title", width: W, height: H, fit: true,
    assets: {
      image: {
        titleLogo: "title.png",
      },
    },
    }).run();
  });
})();
