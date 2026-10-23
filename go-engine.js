(function (global) {
  "use strict";
  var EMPTY = 0,
    BLACK = 1,
    WHITE = 2,
    BLOCK = 3;
  function key(x, y) {
    return x + "," + y;
  }
  class GoBoard {
    constructor(size, cells) {
      this.size = size;
      this.cells = cells ? cells.slice() : Array(size * size).fill(EMPTY);
    }
    clone() {
      return new GoBoard(this.size, this.cells);
    }
    inside(x, y) {
      return x >= 0 && y >= 0 && x < this.size && y < this.size;
    }
    index(x, y) {
      return y * this.size + x;
    }
    get(x, y) {
      return this.inside(x, y) ? this.cells[this.index(x, y)] : -1;
    }
    set(x, y, v) {
      if (!this.inside(x, y)) return false;
      this.cells[this.index(x, y)] = v;
      return true;
    }
    neighbors(x, y) {
      return [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].filter((p) => this.inside(p[0], p[1]));
    }
    groupAt(x, y) {
      var color = this.get(x, y);
      if (color !== BLACK && color !== WHITE) return null;
      var stack = [[x, y]],
        seen = Object.create(null),
        libSeen = Object.create(null),
        stones = [],
        liberties = [];
      while (stack.length) {
        var p = stack.pop(),
          k = key(p[0], p[1]);
        if (seen[k]) continue;
        seen[k] = true;
        stones.push({ x: p[0], y: p[1] });
        for (var n of this.neighbors(p[0], p[1])) {
          var v = this.get(n[0], n[1]),
            nk = key(n[0], n[1]);
          if ((v === EMPTY || v === BLOCK) && !libSeen[nk]) {
            libSeen[nk] = true;
            liberties.push({ x: n[0], y: n[1], playable: v === EMPTY });
          } else if (v === color && !seen[nk]) stack.push(n);
        }
      }
      return { color: color, stones: stones, liberties: liberties };
    }
    playableLiberties(g) {
      return g ? g.liberties.filter((l) => l.playable) : [];
    }
    play(x, y, color) {
      if (!this.inside(x, y) || this.get(x, y) !== EMPTY) return null;
      var next = this.clone();
      next.set(x, y, color);
      var opp = color === BLACK ? WHITE : BLACK,
        captured = [],
        checked = Object.create(null);
      for (var n of next.neighbors(x, y)) {
        if (next.get(n[0], n[1]) !== opp || checked[key(n[0], n[1])]) continue;
        var g = next.groupAt(n[0], n[1]);
        g.stones.forEach((s) => (checked[key(s.x, s.y)] = true));
        if (g.liberties.length === 0)
          g.stones.forEach((s) => {
            next.set(s.x, s.y, EMPTY);
            captured.push(s);
          });
      }
      var own = next.groupAt(x, y);
      if (!own || own.liberties.length === 0) return null;
      return { board: next, captured: captured, group: own };
    }
  }
  class LadderEngine {
    constructor(board, target, goal) {
      this.board = board;
      this.target = target;
      this.goal = goal;
      this.memo = Object.create(null);
      this.maxRead = board.size * board.size * 4;
    }
    targetGroup(b, t) {
      return t && b.get(t.x, t.y) === WHITE ? b.groupAt(t.x, t.y) : null;
    }
    playable(b, g) {
      return b.playableLiberties(g);
    }
    containsGoal(g) {
      return (
        g && g.stones.some((s) => s.x === this.goal.x && s.y === this.goal.y)
      );
    }
    capturableBlackGroups(b, wg, escape) {
      var checked = Object.create(null),
        out = [];
      for (var ws of wg.stones)
        for (var n of b.neighbors(ws.x, ws.y)) {
          if (b.get(n[0], n[1]) !== BLACK) continue;
          var bg = b.groupAt(n[0], n[1]),
            id = bg.stones
              .map((s) => key(s.x, s.y))
              .sort()
              .join("|");
          if (checked[id]) continue;
          checked[id] = true;
          var pl = this.playable(b, bg);
          if (bg.liberties.length !== 1 || pl.length !== 1) continue;
          var m = pl[0];
          if (escape && m.x === escape.x && m.y === escape.y) continue;
          var r = b.play(m.x, m.y, WHITE);
          if (
            r &&
            r.captured.some((s) =>
              bg.stones.some((bs) => bs.x === s.x && bs.y === s.y),
            )
          )
            out.push({ move: m, group: bg });
        }
      return out;
    }
    hasObstacleLiberty(b, g) {
      return !!(g && g.liberties.some((l) => b.get(l.x, l.y) === BLOCK));
    }
    whiteEscape(b, t) {
      var g = this.targetGroup(b, t);
      if (!g) return { status: "captured" };
      if (this.containsGoal(g)) return { status: "goal" };
      /* 白の選択肢は実際に着手できる気だけで判定する。 */ var pl =
          this.playable(b, g),
        escape = pl.length === 1 ? pl[0] : null,
        caps = this.capturableBlackGroups(b, g, escape);
      if (caps.length) return { status: "white-can-capture", captures: caps };
      if (pl.length !== 1) {
        if (pl.length > 1)
          return { status: "white-branch", count: pl.length, liberties: pl };
        return {
          status: this.hasObstacleLiberty(b, g) ? "obstacle" : "no-escape",
          count: 0,
          liberties: pl,
        };
      }
      var m = pl[0],
        r = b.play(m.x, m.y, WHITE);
      if (!r) return { status: "illegal" };
      var eg = r.board.groupAt(m.x, m.y),
        next = this.playable(r.board, eg);
      if (this.containsGoal(eg))
        return { status: "goal", move: m, board: r.board, target: m };
      if (next.length !== 2) {
        if (next.length > 2)
          return {
            status: "white-branch",
            count: next.length,
            move: m,
            board: r.board,
            target: m,
            liberties: next,
          };
        return {
          status: this.hasObstacleLiberty(r.board, eg)
            ? "obstacle"
            : "no-escape",
          count: next.length,
          move: m,
          board: r.board,
          target: m,
          liberties: next,
        };
      }
      return { status: "ok", move: m, board: r.board, target: m };
    }
    blackCandidates(b, t) {
      var g = this.targetGroup(b, t),
        out = [];
      if (!g) return out;
      for (var m of this.playable(b, g)) {
        var r = b.play(m.x, m.y, BLACK);
        if (!r) continue;
        var ng = this.targetGroup(r.board, t);
        /* 黒は障害物を黒石代わりに利用できない。障害物を含む全ての気が1つで、かつその気に実際に着手できる場合だけアタリ。 */ if (
          ng &&
          ng.liberties.length === 1 &&
          this.playable(r.board, ng).length === 1
        )
          out.push({ move: m, board: r.board, target: t });
      }
      return out;
    }
    // 説明用。分岐局面で黒を1手置き、残る白の逃げ道が最大の局面を返す。
    explainBranch(b, t) {
      var g = this.targetGroup(b, t);
      if (!g) return null;
      var candidates = [];
      for (var m of this.playable(b, g)) {
        var r = b.play(m.x, m.y, BLACK);
        if (!r) continue;
        var ng = this.targetGroup(r.board, t),
          pl = this.playable(r.board, ng);
        if (pl.length >= 2)
          candidates.push({
            move: m,
            board: r.board,
            target: t,
            liberties: pl,
          });
      }
      candidates.sort(
        (a, b) =>
          b.liberties.length - a.liberties.length ||
          a.move.y - b.move.y ||
          a.move.x - b.move.x,
      );
      return candidates[0] || null;
    }
    stateKey(b, t, turn) {
      return turn + "|" + t.x + "," + t.y + "|" + b.cells.join("");
    }
    rank(o) {
      // 黒は最終結果を最優先。捕獲できる変化を、長く追えるだけの変化より優先する。
      var r = {
        captured: 100,
        noEscape: 95,
        blackNone: 60,
        whiteCanCapture: 35,
        whiteBranch: 30,
        obstacle: 25,
        readLimit: 15,
        cycle: 10,
        illegal: 5,
        goal: 0,
      };
      return r[o] === undefined ? -1 : r[o];
    }
    compare(a, b) {
      var rankA = this.rank(a.outcome), rankB = this.rank(b.outcome);
      if (rankA !== rankB) return rankA > rankB ? 1 : -1;
      if (a.plies !== b.plies) return a.plies > b.plies ? 1 : -1;
      return 0;
    }
    read(b, t, turn, path, d) {
      if (d >= this.maxRead) return { outcome: "readLimit", plies: 0 };
      var k = this.stateKey(b, t, turn);
      if (path[k]) return { outcome: "cycle", plies: 0 };
      if (this.memo[k])
        return { outcome: this.memo[k].outcome, plies: this.memo[k].plies };
      var np = Object.assign(Object.create(null), path);
      np[k] = true;
      var ans;
      if (turn === "white") {
        var w = this.whiteEscape(b, t);
        if (w.status === "goal")
          ans = { outcome: "goal", plies: w.move ? 1 : 0 };
        else if (w.status === "captured")
          ans = { outcome: "captured", plies: 0 };
        else if (w.status === "white-branch")
          ans = { outcome: "whiteBranch", plies: 0 };
        else if (w.status === "white-can-capture")
          ans = { outcome: "whiteCanCapture", plies: 0 };
        else if (w.status === "obstacle")
          ans = { outcome: "obstacle", plies: 0 };
        else if (w.status === "no-escape")
          ans = { outcome: "noEscape", plies: 0 };
        else if (w.status === "illegal") ans = { outcome: "illegal", plies: 0 };
        else {
          ans = this.read(w.board, w.target, "black", np, d + 1);
          ans = { outcome: ans.outcome, plies: ans.plies + 1 };
        }
      } else {
        var cs = this.blackCandidates(b, t);
        if (!cs.length) ans = { outcome: "blackNone", plies: 0 };
        else {
          ans = null;
          for (var c of cs) {
            var rr = this.read(c.board, c.target, "white", np, d + 1);
            rr = { outcome: rr.outcome, plies: rr.plies + 1 };
            if (!ans || this.compare(rr, ans) > 0) ans = rr;
          }
        }
      }
      if (ans.outcome !== "cycle" && ans.outcome !== "readLimit")
        this.memo[k] = { outcome: ans.outcome, plies: ans.plies };
      return ans;
    }
    incoming(b, t) {
      var a = [];
      for (var n of b.neighbors(t.x, t.y))
        if (b.get(n[0], n[1]) === WHITE)
          a.push({ dx: t.x - n[0], dy: t.y - n[1] });
      return a;
    }
    direction(c, inc) {
      if (!inc.length) return 0;
      var w = this.whiteEscape(c.board, c.target);
      if (!w.move) return 0;
      var dx = w.move.x - c.target.x,
        dy = w.move.y - c.target.y,
        best = -999;
      for (var v of inc) best = Math.max(best, v.dx * dx + v.dy * dy);
      return best;
    }
    chooseBlack() {
      var cs = this.blackCandidates(this.board, this.target);
      if (!cs.length) return { status: "black-none" };
      var inc = this.incoming(this.board, this.target),
        ev = cs.map((c) => {
          var f = this.read(c.board, c.target, "white", Object.create(null), 0);
          return {
            candidate: c,
            result: { outcome: f.outcome, plies: f.plies + 1 },
            ds: this.direction(c, inc),
          };
        });
      ev.sort((a, b) => {
        var r = this.compare(a.result, b.result);
        if (r) return -r;
        if (a.ds !== b.ds) return b.ds - a.ds;
        if (a.candidate.move.y !== b.candidate.move.y)
          return a.candidate.move.y - b.candidate.move.y;
        return a.candidate.move.x - b.candidate.move.x;
      });
      var z = ev[0];
      return {
        status: "ok",
        move: z.candidate.move,
        board: z.candidate.board,
        target: z.candidate.target,
      };
    }
    stepWhite() {
      return this.whiteEscape(this.board, this.target);
    }
  }
  global.GoLogic = {
    EMPTY: EMPTY,
    BLACK: BLACK,
    WHITE: WHITE,
    BLOCK: BLOCK,
    GoBoard: GoBoard,
    LadderEngine: LadderEngine,
  };
})(typeof window !== "undefined" ? window : globalThis);
