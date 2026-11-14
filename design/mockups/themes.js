// The five visual themes. A theme owns inks, type and the cup; Sally's drawing stays the same.
// `pal` gives the mascot's colour slots for each ground it is printed on in that theme. In Sally's
// drawing ink is her mug, fill her body, accent her gills, spot her freckles, iris the ring round
// her eye, eye the pupil and line her mouth; paper is the ground (the mug's stripe and, in one ink,
// the gap lines). Her body stays a salamander's dusky pink in every theme and her gills stay red.
// `wm` is the wordmark's type, as inline CSS, so the pages, the brand kit and the cup agree.
window.THEMES = {
  poster: {
    id: "poster", n: "01", file: "01-poster.html", title: "Riso gig poster", name: "sally",
    idea: "Three spot inks on newsprint, printed a hair off register. The menu is the line-up, the receipt is a ticket stub and the numbers are the box office.",
    fonts: "Bowlby+One&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700",
    wm: "font-family:'Bowlby One',sans-serif;text-transform:uppercase;letter-spacing:.005em;line-height:.88",
    type: [["Bowlby One", "'Bowlby One'", 400], ["Space Grotesk", "'Space Grotesk'", 500], ["Space Mono", "'Space Mono'", 400]],
    colors: [["Newsprint", "#F2EBDD"], ["Riso blue", "#2B3A8F"], ["Fluoro pink", "#FF77AE"], ["Bright red", "#F04A3A"], ["Sun yellow", "#FFD23F"]],
    pal: {
      paper: { bg: "#F2EBDD", ink: "#2B3A8F", fill: "#FF77AE", accent: "#F04A3A", paper: "#F2EBDD", spot: "#FFE1EC", iris: "#FFD23F", eye: "#1C2766", line: "#A8346A" },
      dark: { bg: "#2B3A8F", ink: "#F2EBDD", fill: "#FF77AE", accent: "#FF5A44", paper: "#2B3A8F", spot: "#FFE1EC", iris: "#FFD23F", eye: "#1C2766", line: "#A8346A" },
      pop: { bg: "#FFD23F", ink: "#2B3A8F", fill: "#FF77AE", accent: "#F04A3A", paper: "#FFD23F", spot: "#FFE1EC", iris: "#F2EBDD", eye: "#1C2766", line: "#A8346A" },
    },
    cup: { body: "#FFD23F", lid: "#2B3A8F", pal: "pop", ink: "#2B3A8F" },
  },
  book: {
    id: "book", n: "02", file: "02-picture-book.html", title: "Mid-century picture book", name: "sally",
    idea: "Flat cut-paper colour, walnut and brass, and a storybook's voice: a children's book about one salamander's coffee shop, the kind printed in 1958.",
    fonts: "Shrikhand&family=Josefin+Sans:wght@400;600;700&family=Libre+Caslon+Text:ital,wght@0,400;1,400",
    wm: "font-family:Shrikhand,serif;letter-spacing:.005em;line-height:.95",
    type: [["Shrikhand", "Shrikhand", 400], ["Libre Caslon italic", "'Libre Caslon Text';font-style:italic", 400], ["Josefin Sans", "'Josefin Sans'", 600]],
    colors: [["Cream", "#F4EBD9"], ["Walnut", "#4A2F20"], ["Spring teal", "#2F6F6A"], ["Dusty rose", "#E39C9A"], ["Coral", "#D24F34"], ["Brass", "#D9A441"]],
    pal: {
      paper: { bg: "#F4EBD9", ink: "#4A2F20", fill: "#E39C9A", accent: "#D24F34", paper: "#F4EBD9", spot: "#F7DCD4", iris: "#D9A441", eye: "#2A1A11", line: "#8A4A45" },
      dark: { bg: "#2F6F6A", ink: "#F4EBD9", fill: "#EBA7A3", accent: "#F06B4B", paper: "#2F6F6A", spot: "#F9E3DC", iris: "#E6B655", eye: "#2A1A11", line: "#8A4A45" },
      pop: { bg: "#D9A441", ink: "#4A2F20", fill: "#E8A3A0", accent: "#C9452D", paper: "#D9A441", spot: "#F7DCD4", iris: "#F4EBD9", eye: "#2A1A11", line: "#8A4A45" },
    },
    cup: { body: "#2F6F6A", lid: "#4A2F20", pal: "dark", ink: "#F4EBD9" },
  },
  sign: {
    id: "sign", n: "03", file: "03-sign-painter.html", title: "Sign painter and ticket rail", name: "sally",
    idea: "A hand-painted South Congress wall sign out front and a diner ticket rail in the back: one-stroke script, enamel colours and drop shades.",
    fonts: "Yellowtail&family=Big+Shoulders+Display:wght@600;800;900&family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700",
    wm: "font-family:Yellowtail,cursive;letter-spacing:0;line-height:.95",
    type: [["Yellowtail", "Yellowtail", 400], ["Big Shoulders Display", "'Big Shoulders Display'", 900], ["Barlow", "Barlow", 500]],
    colors: [["Enamel cream", "#F5EAD0"], ["Lamp black", "#1A1613"], ["Sign red", "#C9321F"], ["Turquoise", "#1F9E98"], ["Mustard", "#EDB230"], ["Shell pink", "#EE9E9B"]],
    pal: {
      paper: { bg: "#F5EAD0", ink: "#1A1613", fill: "#EE9E9B", accent: "#C9321F", paper: "#F5EAD0", spot: "#FBE0D9", iris: "#EDB230", eye: "#1A1613", line: "#8A3B36" },
      dark: { bg: "#1A1613", ink: "#F5EAD0", fill: "#EE9E9B", accent: "#E5452E", paper: "#1A1613", spot: "#FBE0D9", iris: "#EDB230", eye: "#1A1613", line: "#8A3B36" },
      pop: { bg: "#1F9E98", ink: "#1A1613", fill: "#F2A9A5", accent: "#C9321F", paper: "#1F9E98", spot: "#FBE0D9", iris: "#EDB230", eye: "#1A1613", line: "#8A3B36" },
    },
    cup: { body: "#1F9E98", lid: "#F5EAD0", pal: "pop", ink: "#1A1613" },
  },
  cozy: {
    id: "cozy", n: "04", file: "04-cozy.html", title: "Cozy-game café", name: "sally",
    idea: "A shop you would visit in a cozy game: soft panels, a stamp card, and a Sally whose mood follows how busy the counter is.",
    fonts: "Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800",
    wm: "font-family:Fredoka,sans-serif;font-weight:700;letter-spacing:-.01em;line-height:.95",
    type: [["Fredoka", "Fredoka", 700], ["Fredoka", "Fredoka", 500], ["Nunito", "Nunito", 600]],
    colors: [["Oat milk", "#FFF5E4"], ["Plum", "#55406B"], ["Blossom", "#F2A3B5"], ["Coral", "#EF6A5A"], ["Butter", "#FFD27A"], ["Mint", "#BFE3CF"]],
    pal: {
      paper: { bg: "#FFF5E4", ink: "#55406B", fill: "#F2A3B5", accent: "#EF6A5A", paper: "#FFF5E4", spot: "#FFE4EA", iris: "#FFC54D", eye: "#3B2A4D", line: "#9A4E6A" },
      dark: { bg: "#55406B", ink: "#FFF5E4", fill: "#F5AFC0", accent: "#FF8170", paper: "#55406B", spot: "#FFE4EA", iris: "#FFD27A", eye: "#3B2A4D", line: "#9A4E6A" },
      pop: { bg: "#BFE3CF", ink: "#55406B", fill: "#EE94AA", accent: "#EF6A5A", paper: "#BFE3CF", spot: "#FFE4EA", iris: "#FFC54D", eye: "#3B2A4D", line: "#9A4E6A" },
    },
    cup: { body: "#BFE3CF", lid: "#55406B", pal: "pop", ink: "#55406B" },
  },
  field: {
    id: "field", n: "05", file: "05-field-guide.html", title: "Hill Country field guide", name: "sally",
    idea: "A naturalist's guide to one coffee shop: Sally as a specimen plate, a checklist menu that says how common each drink is, and field notes for the numbers.",
    fonts: "Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600",
    wm: "font-family:'Cormorant Garamond',serif;font-weight:700;letter-spacing:-.01em;line-height:.9",
    type: [["Cormorant Garamond", "'Cormorant Garamond'", 700], ["Cormorant italic", "'Cormorant Garamond';font-style:italic", 500], ["IBM Plex Mono", "'IBM Plex Mono'", 400]],
    colors: [["Limestone", "#ECE6D6"], ["Cedar", "#2B3D31"], ["Sage", "#8FA07F"], ["Specimen mauve", "#B48E98"], ["Rust", "#B8462C"], ["Kraft", "#C8A882"]],
    pal: {
      paper: { bg: "#ECE6D6", ink: "#2B3D31", fill: "#B48E98", accent: "#B8462C", paper: "#ECE6D6", spot: "#EADBD9", iris: "#C99A3A", eye: "#1F2B22", line: "#5E3F49" },
      dark: { bg: "#2B3D31", ink: "#ECE6D6", fill: "#C49FA8", accent: "#E06A44", paper: "#2B3D31", spot: "#EADBD9", iris: "#D9AE55", eye: "#1F2B22", line: "#5E3F49" },
      pop: { bg: "#C8A882", ink: "#2B3D31", fill: "#B48E98", accent: "#A9402A", paper: "#C8A882", spot: "#EADBD9", iris: "#ECE6D6", eye: "#1F2B22", line: "#5E3F49" },
    },
    cup: { body: "#C8A882", lid: "#2B3D31", pal: "pop", ink: "#2B3D31" },
  },
};
window.THEME_IDS = ["poster", "book", "sign", "cozy", "field"];
window.fontsHref = (t) => `https://fonts.googleapis.com/css2?family=${t.fonts}&display=swap`;
