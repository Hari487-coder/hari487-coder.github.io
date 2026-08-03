/** "3 credits", "1 credit". Semester 1 carries two 1-credit electives. */
export function credits(n: number): string {
  return `${n} credit${n === 1 ? '' : 's'}`;
}
