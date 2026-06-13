/**
 * PostCSS é necessário para o Tailwind processar as classes CSS
 * O autoprefixer adiciona prefixos de vendor (-webkit-, -moz-, etc.)
 * para compatibilidade com browsers antigos.
 */

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
