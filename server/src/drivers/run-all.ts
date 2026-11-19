/**
 * Run the kernel module drivers required by DDS §10.1
 * (M01–M07, M10, M13, M14) and print one structured line each.
 *
 *   npm run drivers            # all drivers
 *   npm run drivers -- M04     # only drivers whose name contains "M04"
 */
import m01 from "./m01.driver";
import m02 from "./m02.driver";
import m03 from "./m03.driver";
import m04 from "./m04.driver";
import m05 from "./m05.driver";
import m06 from "./m06.driver";
import m07 from "./m07.driver";
import m10 from "./m10.driver";
import m13 from "./m13.driver";
import m14 from "./m14.driver";

const drivers = [m01, m02, m03, m04, m05, m06, m07, m10, m13, m14];
const filter = process.argv[2];

const results = [];
for (const driver of drivers) {
  if (filter && !driver.module.includes(filter)) continue;
  results.push(await driver.run());
}
console.table(results);
