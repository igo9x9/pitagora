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
    constructor(board, target, goals) {
      this.board = board;
      this.target = target;
      this.goals = Array.isArray(goals) ? goals : goals ? [goals] : [];
      this.memo = Object.create(null);
      this.maxRead = board.size * board.size * 4;
    }
    targetGroup(b, t) {
      return t && b.get(t.x, t.y) === WHITE ? b.groupAt(t.x, t.y) : null;
    }
    playable(b, g) {
      return b.playableLiberties(g);
    }
    goalsInGroup(g) {
      if (!g) return [];
      return this.goals.filter((goal) =>
        g.stones.some((stone) => stone.x === goal.x && stone.y === goal.y),
      );
    }
    containsGoal(g) {
      return this.goalsInGroup(g).length > 0;
    }
    goalAtMove(move) {
      if (!move) return null;
      return (
        this.goals.find((goal) => goal.x === move.x && goal.y === move.y) || null
      );
    }
    isGoalMove(move) {
      return !!this.goalAtMove(move);
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
    playWhiteCapture(b, t, captures) {
      if (!captures || !captures.length) return null;
      var ordered = captures.slice().sort((a, b) =>
        a.move.y - b.move.y || a.move.x - b.move.x,
      );
      for (var capture of ordered) {
        var move = capture.move;
        var result = b.play(move.x, move.y, WHITE);
        if (!result) continue;
        // 元の追跡対象が捕獲後も白石として残るなら、その白一団を追い続ける。
        // 元の対象が消えた場合だけ、捕獲手の白石を新しい対象にする。
        var nextTarget =
          t && result.board.get(t.x, t.y) === WHITE
            ? { x: t.x, y: t.y }
            : { x: move.x, y: move.y };
        return {
          board: result.board,
          target: nextTarget,
          move: { x: move.x, y: move.y },
          captured: result.captured,
        };
      }
      return null;
    }
    hasObstacleLiberty(b, g) {
      return !!(g && g.liberties.some((l) => b.get(l.x, l.y) === BLOCK));
    }
    whiteCandidates(b, t) {
      var g = this.targetGroup(b, t);
      if (!g) return [];
      var byKey = Object.create(null);
      var add = (move, kind) => {
        if (!move) return;
        var k = key(move.x, move.y);
        var r = b.play(move.x, move.y, WHITE);
        if (!r) return;
        if (byKey[k]) {
          if (kind === "capture") byKey[k].kind = "escape-capture";
          return;
        }
        var nextTarget =
          t && r.board.get(t.x, t.y) === WHITE
            ? { x: t.x, y: t.y }
            : { x: move.x, y: move.y };
        byKey[k] = {
          move: { x: move.x, y: move.y },
          kind: kind,
          board: r.board,
          target: nextTarget,
          captured: r.captured || [],
        };
      };

      // 通常の逃げ手と黒を取る手を、同じ白候補として列挙する。
      this.playable(b, g).forEach((move) => add(move, "escape"));
      this.capturableBlackGroups(b, g, null).forEach((capture) =>
        add(capture.move, "capture"),
      );
      return Object.keys(byKey).map((k) => byKey[k]);
    }
    whiteCandidateImmediateResult(candidate) {
      var g = this.targetGroup(candidate.board, candidate.target);
      if (!g) return { outcome: "captured", plies: 0 };
      var next = this.playable(candidate.board, g);
      if (next.length > 2) return { outcome: "whiteBranch", plies: 0 };
      if (next.length < 2)
        return {
          outcome: this.hasObstacleLiberty(candidate.board, g)
            ? "obstacle"
            : "noEscape",
          plies: 0,
        };
      return null;
    }
    evaluateWhiteCandidate(candidate, path, depth) {
      var immediate = this.whiteCandidateImmediateResult(candidate);
      if (immediate) return immediate;
      var result = this.read(
        candidate.board,
        candidate.target,
        "black",
        path,
        depth + 1,
      );
      return { outcome: result.outcome, plies: result.plies + 1 };
    }
    selectWhiteEvaluation(evaluations) {
      evaluations.sort((a, b) => {
        // compare()は黒にとって良い方を正とする。白はその逆を選ぶ。
        var comparison = this.compare(a.result, b.result);
        if (comparison) return comparison;
        if (a.candidate.move.y !== b.candidate.move.y)
          return a.candidate.move.y - b.candidate.move.y;
        return a.candidate.move.x - b.candidate.move.x;
      });
      return evaluations[0] || null;
    }
    chooseWhite(b, t, checkGoal, path, depth) {
      if (checkGoal === undefined) checkGoal = true;
      path = path || Object.create(null);
      depth = depth || 0;
      var g = this.targetGroup(b, t);
      if (!g) return { status: "captured" };

      var liberties = this.playable(b, g);
      // 黒の着手後にすでに逃げ道が複数なら、白はシチョウから脱出済み。
      if (liberties.length > 1)
        return { status: "white-branch", count: liberties.length, liberties: liberties };

      var candidates = this.whiteCandidates(b, t);
      if (!candidates.length)
        return {
          status: this.hasObstacleLiberty(b, g) ? "obstacle" : "no-escape",
          count: 0,
          liberties: liberties,
        };

      if (checkGoal) {
        var goalCandidates = candidates.filter((candidate) =>
          this.isGoalMove(candidate.move),
        );
        if (goalCandidates.length) {
          goalCandidates.sort((a, b) =>
            a.move.y - b.move.y || a.move.x - b.move.x,
          );
          var goalCandidate = goalCandidates[0];
          var reachedGoal = this.goalAtMove(goalCandidate.move);
          return {
            status: "goal",
            goals: reachedGoal ? [reachedGoal] : [],
            move: goalCandidate.move,
            board: goalCandidate.board,
            target: goalCandidate.target,
            captured: goalCandidate.captured,
            kind: goalCandidate.kind,
          };
        }
      }
      var evaluations = candidates.map((candidate) => ({
        candidate: candidate,
        result: this.evaluateWhiteCandidate(candidate, path, depth),
      }));
      var selected = this.selectWhiteEvaluation(evaluations);
      if (!selected) return { status: "illegal" };
      var c = selected.candidate;
      var immediate = this.whiteCandidateImmediateResult(c);
      if (immediate && immediate.outcome === "whiteBranch") {
        var branchGroup = this.targetGroup(c.board, c.target);
        var branchLiberties = this.playable(c.board, branchGroup);
        return {
          status: "white-branch",
          count: branchLiberties.length,
          liberties: branchLiberties,
          move: c.move,
          board: c.board,
          target: c.target,
          captured: c.captured,
          kind: c.kind,
        };
      }
      if (immediate && immediate.outcome === "obstacle")
        return { status: "obstacle", move: c.move, board: c.board, target: c.target };
      if (immediate && immediate.outcome === "noEscape")
        return { status: "no-escape", move: c.move, board: c.board, target: c.target };
      return {
        status: "ok",
        move: c.move,
        board: c.board,
        target: c.target,
        captured: c.captured,
        kind: c.kind,
      };
    }
    whiteEscape(b, t, checkGoal) {
      // 黒の内部読みでは、ゲーム固有のゴール情報を使わない。
      if (checkGoal === undefined) checkGoal = true;
      var g = this.targetGroup(b, t);
      if (!g) return { status: "captured" };
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
      if (!r) return {
        status: "no-escape",
        count: 0,
        liberties: [],
      };
      var eg = r.board.groupAt(m.x, m.y),
        next = this.playable(r.board, eg);
      if (checkGoal && this.isGoalMove(m)) {
        var reachedGoal = this.goalAtMove(m);
        return {
          status: "goal",
          goals: reachedGoal ? [reachedGoal] : [],
          move: m,
          board: r.board,
          target: t,
        };
      }
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
    adjacentBlackGroupsInAtari(b, whiteGroup) {
      var checked = Object.create(null),
        groups = [];
      if (!whiteGroup) return groups;

      for (var ws of whiteGroup.stones) {
        for (var n of b.neighbors(ws.x, ws.y)) {
          if (b.get(n[0], n[1]) !== BLACK) continue;
          var bg = b.groupAt(n[0], n[1]);
          if (!bg) continue;
          var id = bg.stones
            .map((stone) => key(stone.x, stone.y))
            .sort()
            .join("|");
          if (checked[id]) continue;
          checked[id] = true;
          if (bg.liberties.length === 1) groups.push(bg);
        }
      }
      return groups;
    }
    blackCandidateSafety(b, t) {
      // 黒候補の直後、白の唯一の逃げ手を実際に1手進める。
      var whiteReply = this.whiteEscape(b, t, false);
      if (whiteReply.status === "white-can-capture") {
        return { safe: false, reason: "white-can-capture-now" };
      }

      // 白が通常どおり逃げた後、その白の連に接する黒一団が
      // アタリなら、その黒手はシチョウを崩す危険手として除外する。
      if (whiteReply.status === "ok" && whiteReply.board && whiteReply.target) {
        var escapedWhite = this.targetGroup(
          whiteReply.board,
          whiteReply.target,
        );
        var blackAtariGroups = this.adjacentBlackGroupsInAtari(
          whiteReply.board,
          escapedWhite,
        );
        if (blackAtariGroups.length > 0) {
          return {
            safe: false,
            reason: "black-in-atari-after-white-escape",
            groups: blackAtariGroups,
          };
        }
      }

      return { safe: true, whiteReply: whiteReply };
    }
    blackCandidates(b, t) {
      var g = this.targetGroup(b, t),
        out = [];
      if (!g) return out;

      for (var m of this.playable(b, g)) {
        var r = b.play(m.x, m.y, BLACK);
        if (!r) continue;
        var ng = this.targetGroup(r.board, t);

        // この一手で対象の白石を取り切った場合も黒候補に含める。
        // 白石が消えるとngはnullになるため、アタリ判定より先に扱う。
        if (!ng) {
          out.push({
            move: m,
            board: r.board,
            target: t,
            immediateCapture: true,
          });
          continue;
        }

        // 白が残る場合は、本当にアタリになる手だけを候補にする。
        if (ng.liberties.length !== 1) continue;
        if (this.playable(r.board, ng).length !== 1) continue;

        // var safety = this.blackCandidateSafety(r.board, t);
        // if (!safety.safe) {
        //   console.debug("黒候補を除外", {
        //     move: m,
        //     reason: safety.reason,
        //   });
        //   continue;
        // }

        out.push({
          move: m,
          board: r.board,
          target: t,
          immediateCapture: false,
        });
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
      // 捕獲成功は同格。捕獲不能として確定した失敗理由も同格にする。
      var r = {
        captured: 100,
        noEscape: 100,

        blackNone: 50,
        whiteCanCapture: 50,
        whiteBranch: 50,
        obstacle: 50,
        illegal: 50,

        // 深さ上限・循環は結果未確定なので、確定した失敗より下に置く。
        readLimit: 10,
        cycle: 10,
      };
      return r[o] === undefined ? -1 : r[o];
    }
    compare(a, b) {
      var rankA = this.rank(a.outcome),
        rankB = this.rank(b.outcome);

      // まず、捕獲成功 > 捕獲不能 > 未確定結果、の順で比較する。
      if (rankA !== rankB) return rankA > rankB ? 1 : -1;

      // 捕獲できる候補同士なら、最短で捕獲できる変化を選ぶ。
      if (rankA === 100 && a.plies !== b.plies)
        return a.plies < b.plies ? 1 : -1;

      // 捕獲不能の候補同士なら、最も長くアタリを継続できる変化を選ぶ。
      if (rankA === 50 && a.plies !== b.plies)
        return a.plies > b.plies ? 1 : -1;

      // readLimitやcycle同士も、暫定的に長く続いた方を優先する。
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
        var g = this.targetGroup(b, t);
        if (!g) ans = { outcome: "captured", plies: 0 };
        else {
          var liberties = this.playable(b, g);
          if (liberties.length > 1)
            ans = { outcome: "whiteBranch", plies: 0 };
          else {
            var whiteCandidates = this.whiteCandidates(b, t);
            if (!whiteCandidates.length)
              ans = {
                outcome: this.hasObstacleLiberty(b, g) ? "obstacle" : "noEscape",
                plies: 0,
              };
            else {
              var whiteEvaluations = whiteCandidates.map((candidate) => ({
                candidate: candidate,
                result: this.evaluateWhiteCandidate(candidate, np, d),
              }));
              var whiteSelected = this.selectWhiteEvaluation(whiteEvaluations);
              ans = whiteSelected.result;
            }
          }
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
      var w = this.whiteEscape(c.board, c.target, false);
      if (!w.move) return 0;
      var dx = w.move.x - c.target.x,
        dy = w.move.y - c.target.y,
        best = -999;
      for (var v of inc) best = Math.max(best, v.dx * dx + v.dy * dy);
      return best;
    }
    chooseBlack() {
      var cs = this.blackCandidates(this.board, this.target);
      if (!cs.length) {
        console.groupCollapsed("[LadderEngine] 黒候補なし");
        console.log("target", this.target);
        console.log("targetGroup", this.targetGroup(this.board, this.target));
        console.groupEnd();
        return { status: "black-none" };
      }

      var inc = this.incoming(this.board, this.target);
      var ev = cs.map((c) => {
        // 即時捕獲は再帰読みに任せず、その場でcapturedと確定する。
        var f = c.immediateCapture
          ? { outcome: "captured", plies: 0 }
          : this.read(c.board, c.target, "white", Object.create(null), 0);
        var evaluation = {
          candidate: c,
          result: { outcome: f.outcome, plies: f.plies + 1 },
          ds: c.immediateCapture ? 0 : this.direction(c, inc),
        };
        return evaluation;
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

      // 原因調査用ログ。1回の黒番を折りたたんで確認できる。
      console.groupCollapsed(
        "[LadderEngine] 黒手選択 target=(" +
          this.target.x +
          "," +
          this.target.y +
          ") candidates=" +
          ev.length,
      );
      console.table(
        ev.map((item, index) => ({
          selected: index === 0 ? "YES" : "",
          x: item.candidate.move.x,
          y: item.candidate.move.y,
          immediateCapture: !!item.candidate.immediateCapture,
          outcome: item.result.outcome,
          plies: item.result.plies,
          rank: this.rank(item.result.outcome),
          direction: item.ds,
        })),
      );
      console.log("selected", {
        move: z.candidate.move,
        immediateCapture: !!z.candidate.immediateCapture,
        outcome: z.result.outcome,
        plies: z.result.plies,
        direction: z.ds,
      });
      console.log("targetGroup before move", this.targetGroup(this.board, this.target));
      console.groupEnd();

      return {
        status: "ok",
        move: z.candidate.move,
        board: z.candidate.board,
        target: z.candidate.target,
        immediateCapture: !!z.candidate.immediateCapture,
      };
    }
    stepWhite() {
      return this.chooseWhite(
        this.board,
        this.target,
        true,
        Object.create(null),
        0,
      );
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
