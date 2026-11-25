import type { LeakCheck } from './types';
import { convertToCountStrings } from './utils';

let bodyChildren: Node[] = [];
let headChildren: Node[] = [];
let href = '';

const describeNode = (node: Node): string =>
  node instanceof Element ? `<${node.localName}>` : node.nodeName;

const getChildChanges = (
  parentName: string,
  before: Node[],
  after: Node[],
): string[] => [
  ...after
    .filter((node) => !before.includes(node))
    .map((node) => `${describeNode(node)} added to ${parentName}`),
  ...before
    .filter((node) => !after.includes(node))
    .map((node) => `${describeNode(node)} removed from ${parentName}`),
];

export const domLeakCheck: LeakCheck = {
  description: 'Document nodes or location changed',
  start: () => {
    bodyChildren = [...document.body.childNodes];
    headChildren = [...document.head.childNodes];
    href = location.href;
  },
  finish: () => [
    ...convertToCountStrings([
      ...getChildChanges('body', bodyChildren, [...document.body.childNodes]),
      ...getChildChanges('head', headChildren, [...document.head.childNodes]),
    ]),
    ...(location.href === href ? [] : [`location changed to ${location.href}`]),
  ],
};
