import { omit, pick } from "lodash";
import { useCallback, useContext } from "react";
import { Record } from "../types/Record";
import GameContext from "../context/GameContext";
import { ResultInputContext } from "../context/ResultInputContext";
import { RichiiList } from "../types/GameStatus";
import { PlayerList } from "../types/Player";
import {
  applyScoreChange,
  getDealer,
  getDeltaWithoutWinner,
  getDeltaWithWinner,
} from "../util/Score";
import { WindNumber } from "../util/Wind";
import { nextGameStatus } from "../Calculator";

export function useGameManager() {
  const {
    setGameStatus,
    setPlayers,
    setRecords: setGameRecord,
  } = useContext(GameContext);

  const {
    winInfo,
    setWinInfo,
    endingType,
    setEndingType,
    tenpai,
    setTenpai,
    resetWinState,
  } = useContext(ResultInputContext);

  const togglePlayerRichii = useCallback(
    (seating: WindNumber, isRichiiNow: boolean) => {
      setPlayers((players) => {
        const newPlayers = [...players] as PlayerList;
        newPlayers[seating] = {
          ...newPlayers[seating],
          score: newPlayers[seating].score - (isRichiiNow ? 1000 : -1000),
        };
        return newPlayers;
      });

      setGameStatus(({ richii, richiiStick, ...props }) => {
        const newRichiiList = [...richii] as RichiiList;
        newRichiiList[seating] = isRichiiNow;
        return {
          ...props,
          richiiStick: richiiStick + (newRichiiList[seating] ? 1 : -1),
          richii: newRichiiList,
        };
      });
    },
    [setGameStatus, setPlayers]
  );

  const pushRecord = useCallback(
    (record: Record) => {
      setGameRecord((gameRecord) => [...gameRecord, record]);
    },
    [setGameRecord]
  );

  const rewind = useCallback(() => {
    // Pop last record
    setGameRecord((gameRecord) => {
      const newRecords = [...gameRecord];
      const lastRecord = newRecords.pop();
      if (lastRecord === undefined) {
        // Rewind triggered when no game has been played yet
        return newRecords;
      }

      // Replace with last status
      setGameStatus((gameStatus) => {
        // Update players' score based on ending and richii
        setPlayers((players) =>
          applyScoreChange(
            players,
            lastRecord.deltas.map(
              (delta, index) => (gameStatus.richii[index] ? 1000 : 0) - delta
            )
          )
        );

        return {
          numPlayers: gameStatus.numPlayers,
          ...pick(lastRecord, "wind", "round", "honba", "richiiStick"),
          richii: [...lastRecord.richii],
        };
      });

      setEndingType(lastRecord.type);
      if (lastRecord.type === "Win") {
        setWinInfo(lastRecord.info);
      } else {
        setTenpai(lastRecord.info);
      }
      return newRecords;
    });
  }, [
    setGameRecord,
    setGameStatus,
    setEndingType,
    setPlayers,
    setWinInfo,
    setTenpai,
  ]);

  const saveEntry = useCallback(() => {
    setGameStatus((gameStatus) => {
      let deltas: number[];
      if (endingType === "Win") {
        deltas = getDeltaWithWinner(winInfo, gameStatus);
      } else {
        deltas = getDeltaWithoutWinner(tenpai);
      }
      setPlayers((players) => applyScoreChange(players, deltas));
      const record: Omit<Record, "info" | "type"> = {
        deltas,
        ...omit(gameStatus, "numPlayers"),
      };
      if (endingType === "Win") {
        pushRecord({
          ...record,
          type: endingType,
          info: winInfo,
        });
      } else {
        pushRecord({
          ...record,
          type: endingType,
          info: tenpai,
        });
      }

      resetWinState(gameStatus);

      return nextGameStatus(
        endingType === "Win" ? winInfo.map((record) => record.winner) : null,
        tenpai[getDealer(gameStatus)],
        gameStatus
      );
    });
  }, [
    endingType,
    pushRecord,
    resetWinState,
    setGameStatus,
    setPlayers,
    tenpai,
    winInfo,
  ]);
  return {
    togglePlayerRichii,
    rewind,
    saveEntry,
  };
}
