import { CHECK_DEADLOCK, matchesUndefined, visitItems } from "#statechart/ir.ts";

export type ListField = "invariants" | "properties" | "constraints" | "actionConstraints";
export type ScalarField = "checkDeadlock" | "init" | "next" | "spec" | "view" | "symmetry" | "type" | "typeConstraint";

export interface Section {
  field?: ListField | ScalarField;
  key: string;
  plural?: string;
  undefinedNoun?: string;
}

export const sections = new Map<string, Section>();
visitItems([
  { key: "CONSTANT", plural: "CONSTANTS" },
  { field: "checkDeadlock", key: CHECK_DEADLOCK },
  { field: "init", key: "INIT", undefinedNoun: "initial predicate" },
  { field: "next", key: "NEXT", undefinedNoun: "next state action" },
  { field: "spec", key: "SPECIFICATION", undefinedNoun: "name" },
  { field: "view", key: "VIEW", undefinedNoun: "view function" },
  { field: "symmetry", key: "SYMMETRY", undefinedNoun: "symmetry function" },
  { field: "type", key: "TYPE" },
  { field: "typeConstraint", key: "TYPE_CONSTRAINT" },
  { field: "invariants", key: "INVARIANT", plural: "INVARIANTS", undefinedNoun: "invariant" },
  { field: "properties", key: "PROPERTY", plural: "PROPERTIES", undefinedNoun: "property" },
  { field: "constraints", key: "CONSTRAINT", plural: "CONSTRAINTS", undefinedNoun: "constraint" },
  { field: "actionConstraints", key: "ACTION_CONSTRAINT", plural: "ACTION_CONSTRAINTS", undefinedNoun: "action constraint" },
] satisfies Section[], (section) => {
  sections.set(section.key, section);
  if (!matchesUndefined(section.plural)) {sections.set(section.plural, section);}
});

// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Infer the standalone configuration field guard without an Effect dependency.
export const isListField = (field: Section["field"]) =>
  field === "invariants" || field === "properties" || field === "constraints" || field === "actionConstraints";
