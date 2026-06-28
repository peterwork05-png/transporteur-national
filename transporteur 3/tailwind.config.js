export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        'tn-red':   '#C0392B',
        'tn-gold':  '#8B6914',
        'tn-dark':  '#1A1208',
        'tn-cream': '#FAF7F0',
        'tn-warm':  '#F0EBE0',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderColor: { DEFAULT: 'rgba(139,105,20,0.15)' },
    },
  },
  plugins: [],
}
