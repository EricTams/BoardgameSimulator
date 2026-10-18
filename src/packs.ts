import { GO_FISH, parsePack } from "./game";
import capitalism from "./packs/capitalism-plus.json";
import garden from "../public/packs/garden.json";

export const BUILTIN_PACKS = [
  GO_FISH,
  parsePack(capitalism),
  parsePack(garden),
];
export function cardImageUrl(image: string) {
  return image.startsWith("packs/")
    ? `${import.meta.env.BASE_URL}${image}`
    : image;
}
