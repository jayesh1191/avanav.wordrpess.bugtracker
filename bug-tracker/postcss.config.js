import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

/** Tailwind's `@tailwind base` (with preflight off) only emits the --tw-* variable defaults on `*`.
 *  Re-scope them to our root so nothing is declared on the rest of the WordPress admin. */
const scopeTailwindBase = () => ({
  postcssPlugin: 'bt-scope-tailwind-base',
  Rule(rule) {
    if (rule.selector === '*, ::before, ::after') {
      rule.selector = '#bug-tracker-root, #bug-tracker-root *, #bug-tracker-root ::before, #bug-tracker-root ::after';
    } else if (rule.selector === '::backdrop') {
      rule.remove();
    }
  },
});
scopeTailwindBase.postcss = true;

export default { plugins: [tailwindcss, autoprefixer, scopeTailwindBase()] };
