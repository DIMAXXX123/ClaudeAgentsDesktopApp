"use client";

import { useState, useEffect, useRef } from "react";
import type { RoomDef, CharacterAnim, Scenario } from "../types";

interface EngineState {
  activeObjectId: string | null;
  activeScenario: Scenario | null;
  characterPos: { x: number; y: number };
  characterAnim: CharacterAnim;
  characterFace: -1 | 1;
}

export function useScenarioEngine(def: RoomDef, working: boolean): EngineState {
  const [state, setState] = useState<EngineState>({
    activeObjectId: null,
    activeScenario: null,
    characterPos: def.character.home,
    characterAnim: "idle",
    characterFace: def.character.face ?? 1,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const targetPosRef = useRef<{ x: number; y: number } | null>(null);
  const currentPosRef = useRef<{ x: number; y: number }>(def.character.home);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Main engine loop
  useEffect(() => {
    if (!working) {
      // Return to home, idle state
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setState({
        activeObjectId: null,
        activeScenario: null,
        characterPos: def.character.home,
        characterAnim: "idle",
        characterFace: def.character.face ?? 1,
      });
      currentPosRef.current = def.character.home;
      targetPosRef.current = null;
      return;
    }

    // Get interactive objects with scenarios
    const interactiveObjects = def.objects.filter(
      (obj) => obj.interactive !== false && obj.scenarios && obj.scenarios.length > 0
    );

    if (interactiveObjects.length === 0) {
      // No interactive objects; stay idle
      setState((prev) => ({
        ...prev,
        activeObjectId: null,
        activeScenario: null,
        characterAnim: "idle",
      }));
      return;
    }

    // Pick random object and first scenario
    const pickNextScenario = () => {
      const obj = interactiveObjects[Math.floor(Math.random() * interactiveObjects.length)];
      const scenarios = obj.scenarios!;
      const scenario = scenarios[0];
      const targetPos = scenario.stand ?? { x: obj.x, y: obj.y };

      return { obj, scenario, targetPos };
    };

    let { obj, scenario, targetPos } = pickNextScenario();

    // Calculate walk time based on distance
    const distance = Math.sqrt(
      (targetPos.x - currentPosRef.current.x) ** 2 +
      (targetPos.y - currentPosRef.current.y) ** 2
    );
    const walkTime = Math.max(0.5, distance / 40);

    // Start walking to target
    targetPosRef.current = targetPos;
    startTimeRef.current = Date.now();

    const animateWalk = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const progress = Math.min(elapsed / walkTime, 1);

      const newPos = {
        x: currentPosRef.current.x + (targetPos.x - currentPosRef.current.x) * progress,
        y: currentPosRef.current.y + (targetPos.y - currentPosRef.current.y) * progress,
      };

      setState((prev) => ({
        ...prev,
        characterPos: newPos,
        characterAnim: "walk",
      }));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animateWalk);
      } else {
        // Walk complete, start scenario
        currentPosRef.current = targetPos;
        const scenarioDuration = (scenario.duration ?? 4) * 1000;

        setState({
          activeObjectId: obj.id,
          activeScenario: scenario,
          characterPos: targetPos,
          characterAnim: scenario.anim,
          characterFace: scenario.face ?? state.characterFace,
        });

        // Hold scenario duration
        timerRef.current = setTimeout(() => {
          // Pick next scenario and repeat
          const next = pickNextScenario();
          obj = next.obj;
          scenario = next.scenario;
          targetPos = next.targetPos;

          const nextDistance = Math.sqrt(
            (targetPos.x - currentPosRef.current.x) ** 2 +
            (targetPos.y - currentPosRef.current.y) ** 2
          );
          const nextWalkTime = Math.max(0.5, nextDistance / 40);

          targetPosRef.current = targetPos;
          startTimeRef.current = Date.now();
          rafRef.current = requestAnimationFrame(animateWalk);
        }, scenarioDuration);
      }
    };

    rafRef.current = requestAnimationFrame(animateWalk);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [working, def]);

  return state;
}

interface ControllerState extends EngineState {
  focus: (objectId: string) => void;
}

export function useScenarioController(def: RoomDef, working: boolean): ControllerState {
  const base = useScenarioEngine(def, working);
  const [override, setOverride] = useState<string | null>(null);
  const overrideTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (overrideTimerRef.current) clearTimeout(overrideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!override) return;

    // Find object and get first scenario
    const obj = def.objects.find((o) => o.id === override);
    if (!obj || !obj.scenarios || obj.scenarios.length === 0) {
      setOverride(null);
      return;
    }

    const scenario = obj.scenarios[0];
    const targetPos = scenario.stand ?? { x: obj.x, y: obj.y };

    // Hold scenario
    const scenarioDuration = (scenario.duration ?? 4) * 1000;
    overrideTimerRef.current = setTimeout(() => {
      setOverride(null);
    }, scenarioDuration);
  }, [override, def]);

  const finalState: ControllerState = {
    ...base,
    activeObjectId: override ?? base.activeObjectId,
    activeScenario: override
      ? (def.objects.find((o) => o.id === override)?.scenarios?.[0] ?? null)
      : base.activeScenario,
    focus: (objectId: string) => {
      if (overrideTimerRef.current) clearTimeout(overrideTimerRef.current);
      setOverride(objectId);
    },
  };

  return finalState;
}
