declare module '*.scss?inline' {
  const css: string;
  export default css;
}
declare module '*.svg' {
  const icon: { path: string; viewBox: string };
  export default icon;
}
declare module '*.jpg';
declare module 'view' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ViewContext {}
}
declare module 'issue' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IssueTriggerContext {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IssueResolveContext {}
}
declare module 'action' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ActionContext {}
}

// The `focusVisible` option is part of the focus specification, but is absent
// from the bundled TypeScript DOM types.
interface FocusOptions {
  focusVisible?: boolean;
}
