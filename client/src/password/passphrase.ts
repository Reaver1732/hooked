const WORDS = `
acorn alpine amber anchor angle apple apron arcade arrow atlas
attic autumn badge bagel baker bamboo banjo barley basil basket
beach beacon beaver berry bicycle biscuit bison blanket blossom bonfire
bottle bramble branch breeze brick bridge brook broom bucket buffalo
bugle butter button cabin cactus camel candle canoe canyon carpet
carrot castle cedar cello chalk cherry chimney cider cinema circus
cliff clock cloud clover cobalt coconut comet compass copper coral
cotton cradle crane crayon cricket crystal cupcake daisy dolphin donkey
dragon drum eagle easel echo elbow ember engine falcon feather
fern ferry fiddle field fig flannel flute forest fossil fountain
fox galaxy garden garlic gazelle geyser ginger glacier globe goblet
goose granite grape gravel guitar hammock harbor harvest hazel hedge
helmet heron hickory honey horizon husky igloo island ivory jacket
jasmine jelly jigsaw journal jungle kayak kettle kitten koala ladder
lagoon lantern lemon lettuce lighthouse lily linen lizard lobster locket
lotus magnet mango maple marble meadow melon meteor mitten moose
mosaic muffin nectar needle nutmeg oasis oatmeal ocean olive onion
orbit orchid otter owl paddle panda papaya parrot peach peanut
pebble pelican pepper piano pickle pigeon pillow pine planet plum
pocket pony popcorn potato prairie pretzel puffin pumpkin puzzle quartz
quill rabbit raccoon radish rainbow raven reef ribbon river robin
rocket saddle salmon sandal satchel scarf seashell shadow sparrow spinach
sprout squash squirrel stamp starfish stone sunflower swan teapot thimble
thistle thunder tiger timber toast tomato topaz tractor trumpet tulip
tundra turnip turtle umbrella valley velvet violin volcano waffle walnut
walrus wagon whistle willow window winter wizard yogurt zebra zephyr
`
  .trim()
  .split(/\s+/);

/** Uniform random integer in [0, n), using rejection sampling to avoid modulo bias. */
function randomIndex(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}

export function generatePassphrase(wordCount = 4): string[] {
  return Array.from({ length: wordCount }, () => WORDS[randomIndex(WORDS.length)]);
}
