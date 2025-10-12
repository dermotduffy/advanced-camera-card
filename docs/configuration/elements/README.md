# `elements`

## Introduction to elements <!-- {docsify-ignore} -->

This card supports the [Picture Elements configuration
syntax](https://www.home-assistant.io/lovelace/picture-elements/) to seamlessly
allow the user to add custom elements to the card.

```yaml
elements:
  - [element_1]
  - [element_2]
```

> [!NOTE]
> The Advanced Camera Card allows either a single [action](../actions/README.md) (as in stock Home
> Assistant) or list of [actions](../actions/README.md) to be defined for each class of user interaction
> (e.g. `tap`, `double_tap`, `hold`, etc). See [an example of multiple actions](../../examples.md?id=multiple-actions).

## Elements <!-- {docsify-ignore} -->

| Option                                | Description                       |
| ------------------------------------- | --------------------------------- |
| [Custom Elements](./custom/README.md) | Custom elements.                  |
| [Stock Elements](./stock/README.md)   | Standard Home Assistant elements. |
