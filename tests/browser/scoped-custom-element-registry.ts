// The card renders a few elements that give their shadow root a registry of its
// own (`ScopedRegistryHost` from `@lit-labs/scoped-registry-mixin`, used by the
// media filter and the select). That is not something a browser can do
// natively: it needs this polyfill, which Home Assistant loads for the whole
// frontend. Without it, rendering one of those elements throws "importNode is
// not a function" as Lit tries to clone a template into a registry that has no
// document behind it.
//
// It replaces `customElements` and `attachShadow`, so it has to be the first
// thing the page runs -- hence its own setup file, ahead of every other.
import '@webcomponents/scoped-custom-element-registry/scoped-custom-element-registry.min';
