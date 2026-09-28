export default {
  title: "Texas School District Finance",
  pages: [
    {name: "Statewide explorer", path: "/"},
    {name: "About the data", path: "/about"}
  ],
  root: "src",
  theme: ["air", "near-midnight", "alt", "wide"],
  head: '<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><rect width=%2216%22 height=%2216%22 rx=%223%22 fill=%22%232a78d6%22/></svg>">',
  footer: "Source: Texas Education Agency, Summarized PEIMS Actual Financial Data. Not affiliated with TEA.",
  toc: false,
  search: false,
  cleanUrls: true
};
