# valtio-reactive

[![CI](https://img.shields.io/github/actions/workflow/status/valtiojs/valtio-reactive/ci.yml?branch=main)](https://github.com/valtiojs/valtio-reactive/actions?query=workflow%3ACI)
[![npm](https://img.shields.io/npm/v/valtio-reactive)](https://www.npmjs.com/package/valtio-reactive)
[![size](https://img.shields.io/bundlephobia/minzip/valtio-reactive)](https://bundlephobia.com/result?p=valtio-reactive)
[![discord](https://img.shields.io/discord/627656437971288081)](https://discord.gg/MrQdmzd)

valtio-reactive makes Valtio a reactive library

## Background

See: https://github.com/pmndrs/valtio/discussions/949

## Install

```bash
npm install valtio valtio-reactive
```

## Usage

```js
import { proxy } from 'valtio/vanilla';
import { batch, computed, effect } from 'valtio-reactive';

const state = proxy({ count: 1 });

const derived = computed({
  double: () => state.count * 2,
});

effect(() => {
  console.log('double count:', derived.double);
});

setInterval(() => {
  batch(() => {
    state.count++;
    state.count++;
  });
}, 1000);
```
