/**
 * "Date cannot be in the future" must compare calendar days in the user's
 * LOCAL timezone. 01:00 on 16 Oct in Warsaw is still 15 Oct 23:00Z, so a
 * UTC-midnight comparison used to reject today's own date in that window.
 * The clock is pinned to 01:00 local so the suite is meaningful in any TZ.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";

import {
  makeProcedureLog,
  makeProfile,
} from "../metabolism-feedback-loop/fixtures";

jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return {
    Feather: ({ name }: { name: string }) => (
      <View testID={`feather-icon-${name}`} />
    ),
  };
});

jest.mock("@/services/storage", () => ({
  ...jest.requireActual("@/services/storage"),
  loadJson: jest.fn(async (_k: string, fallback: unknown) => fallback),
  saveJson: jest.fn(async () => undefined),
}));

import { AddProcedureModal } from "@/components/clinic/AddProcedureModal";
import ProcedureDetailScreen from "@/screens/ProcedureDetailScreen";
import { useProceduresStore } from "@/store/proceduresStore";
import { useProfileStore } from "@/store/profileStore";

const FUTURE_ERROR = "Date cannot be in the future";

// 01:00 breaks zones east of UTC; 18:00 breaks zones west of UTC (tomorrow's
// UTC midnight is already in the past there).
describe.each([1, 18])("with the local clock at %i:00", (hour) => {
  const at = `${String(hour).padStart(2, "0")}:00 local time`;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 16, hour, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("AddProcedureModal date validation", () => {
    function renderModalWithPreset(dateText?: string) {
      const onSave = jest.fn();
      render(
        <AddProcedureModal
          visible
          procedures={[]}
          onClose={jest.fn()}
          onSave={onSave}
        />,
      );
      fireEvent.press(screen.getByText("Custom Procedure"));
      fireEvent.changeText(
        screen.UNSAFE_getByProps({ placeholder: "e.g. Laser Resurfacing" }),
        "Microneedling",
      );
      fireEvent.press(screen.getByText("Redness / Peeling"));
      if (dateText !== undefined) {
        fireEvent.changeText(
          screen.UNSAFE_getByProps({ placeholder: "DD / MM / YYYY" }),
          dateText,
        );
      }
      const nodes = screen.UNSAFE_getAllByProps({ children: "Log Procedure" });
      fireEvent.press(nodes[nodes.length - 1]);
      return onSave;
    }

    it(`accepts the prefilled today date at ${at}`, () => {
      const onSave = renderModalWithPreset();

      expect(screen.queryByText(FUTURE_ERROR)).toBeNull();
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ datePerformed: "2026-10-16" }),
      );
    });

    it(`rejects tomorrow as a future date at ${at}`, () => {
      const onSave = renderModalWithPreset("17/10/2026");

      expect(screen.getByText(FUTURE_ERROR)).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("ProcedureDetailScreen date validation", () => {
    function renderDetailAndSave(dateText: string) {
      useProfileStore.setState({ profile: makeProfile({}), hydrated: true });
      useProceduresStore.setState({
        procedures: [makeProcedureLog()],
        hydrated: true,
      });
      const goBack = jest.fn();
      render(
        <ProcedureDetailScreen
          navigation={{ goBack, navigate: jest.fn() } as any}
          route={{ params: { procedureId: "proc-botox-1" } } as any}
        />,
      );
      fireEvent.changeText(
        screen.UNSAFE_getByProps({ placeholder: "DD/MM/YYYY" }),
        dateText,
      );
      fireEvent.press(screen.getByText("Save"));
      return goBack;
    }

    it(`accepts today as the new date at ${at}`, () => {
      const goBack = renderDetailAndSave("16/10/2026");

      expect(screen.queryByText(FUTURE_ERROR)).toBeNull();
      expect(goBack).toHaveBeenCalled();
      expect(useProceduresStore.getState().procedures[0].datePerformed).toBe(
        "2026-10-16",
      );
    });

    it(`rejects tomorrow as the new date at ${at}`, () => {
      const goBack = renderDetailAndSave("17/10/2026");

      expect(screen.getByText(FUTURE_ERROR)).toBeTruthy();
      expect(goBack).not.toHaveBeenCalled();
      expect(useProceduresStore.getState().procedures[0].datePerformed).toBe(
        "2026-03-12",
      );
    });
  });
});
