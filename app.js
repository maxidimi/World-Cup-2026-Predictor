const rawMatches = [
  [
  "2026-06-11",
  "Group A",
  "Mexico",
  "South Africa",
  "Estadio Azteca",
  "Mexico City",
  "2026-06-11T19:00:00.000Z",
  "13:00",
  "America/Mexico_City"
  ],
  [
  "2026-06-11",
  "Group A",
  "South Korea",
  "Czechia",
  "Estadio Akron",
  "Zapopan",
  "2026-06-12T02:00:00.000Z",
  "20:00",
  "America/Mexico_City"
  ],
  [
  "2026-06-12",
  "Group B",
  "Canada",
  "Bosnia and Herzegovina",
  "BMO Field",
  "Toronto",
  "2026-06-12T19:00:00.000Z",
  "15:00",
  "America/Toronto"
  ],
  [
  "2026-06-12",
  "Group D",
  "United States",
  "Paraguay",
  "SoFi Stadium",
  "Inglewood",
  "2026-06-13T01:00:00.000Z",
  "18:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-13",
  "Group B",
  "Qatar",
  "Switzerland",
  "Levi's Stadium",
  "Santa Clara",
  "2026-06-13T19:00:00.000Z",
  "12:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-13",
  "Group C",
  "Brazil",
  "Morocco",
  "Gillette Stadium",
  "Foxborough",
  "2026-06-13T22:00:00.000Z",
  "18:00",
  "America/New_York"
  ],
  [
  "2026-06-13",
  "Group C",
  "Haiti",
  "Scotland",
  "MetLife Stadium",
  "East Rutherford",
  "2026-06-14T01:00:00.000Z",
  "21:00",
  "America/New_York"
  ],
  [
  "2026-06-13",
  "Group D",
  "Australia",
  "Turkiye",
  "BC Place",
  "Vancouver",
  "2026-06-14T16:00:00.000Z",
  "09:00",
  "America/Vancouver"
  ],
  [
  "2026-06-14",
  "Group E",
  "Ivory Coast",
  "Ecuador",
  "Lincoln Financial Field",
  "Philadelphia",
  "2026-06-14T17:00:00.000Z",
  "12:00",
  "America/Chicago"
  ],
  [
  "2026-06-14",
  "Group E",
  "Germany",
  "Curacao",
  "NRG Stadium",
  "Houston",
  "2026-06-14T20:00:00.000Z",
  "15:00",
  "America/Chicago"
  ],
  [
  "2026-06-14",
  "Group F",
  "Netherlands",
  "Japan",
  "AT&T Stadium",
  "Arlington",
  "2026-06-14T23:00:00.000Z",
  "19:00",
  "America/New_York"
  ],
  [
  "2026-06-14",
  "Group F",
  "Sweden",
  "Tunisia",
  "Estadio BBVA",
  "Guadalupe",
  "2026-06-15T02:00:00.000Z",
  "20:00",
  "America/Mexico_City"
  ],
  [
  "2026-06-15",
  "Group G",
  "Iran",
  "New Zealand",
  "SoFi Stadium",
  "Inglewood",
  "2026-06-15T16:00:00.000Z",
  "12:00",
  "America/New_York"
  ],
  [
  "2026-06-15",
  "Group G",
  "Belgium",
  "Egypt",
  "Lumen Field",
  "Seattle",
  "2026-06-15T19:00:00.000Z",
  "12:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-15",
  "Group H",
  "Saudi Arabia",
  "Uruguay",
  "Hard Rock Stadium",
  "Miami Gardens",
  "2026-06-15T22:00:00.000Z",
  "18:00",
  "America/New_York"
  ],
  [
  "2026-06-15",
  "Group H",
  "Spain",
  "Cape Verde",
  "Mercedes-Benz Stadium",
  "Atlanta",
  "2026-06-16T01:00:00.000Z",
  "18:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-16",
  "Group I",
  "France",
  "Senegal",
  "MetLife Stadium",
  "East Rutherford",
  "2026-06-16T19:00:00.000Z",
  "15:00",
  "America/New_York"
  ],
  [
  "2026-06-16",
  "Group I",
  "Iraq",
  "Norway",
  "Gillette Stadium",
  "Foxborough",
  "2026-06-16T22:00:00.000Z",
  "18:00",
  "America/New_York"
  ],
  [
  "2026-06-16",
  "Group J",
  "Argentina",
  "Algeria",
  "Arrowhead Stadium",
  "Kansas City",
  "2026-06-17T01:00:00.000Z",
  "20:00",
  "America/Chicago"
  ],
  [
  "2026-06-16",
  "Group J",
  "Austria",
  "Jordan",
  "Levi's Stadium",
  "Santa Clara",
  "2026-06-17T04:00:00.000Z",
  "21:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-17",
  "Group K",
  "Portugal",
  "DR Congo",
  "NRG Stadium",
  "Houston",
  "2026-06-17T17:00:00.000Z",
  "12:00",
  "America/Chicago"
  ],
  [
  "2026-06-17",
  "Group K",
  "Uzbekistan",
  "Colombia",
  "Estadio Azteca",
  "Mexico City",
  "2026-06-17T20:00:00.000Z",
  "15:00",
  "America/Chicago"
  ],
  [
  "2026-06-17",
  "Group L",
  "Ghana",
  "Panama",
  "BMO Field",
  "Toronto",
  "2026-06-17T23:00:00.000Z",
  "19:00",
  "America/Toronto"
  ],
  [
  "2026-06-17",
  "Group L",
  "England",
  "Croatia",
  "AT&T Stadium",
  "Arlington",
  "2026-06-18T02:00:00.000Z",
  "20:00",
  "America/Mexico_City"
  ],
  [
  "2026-06-18",
  "Group A",
  "Czechia",
  "South Africa",
  "Mercedes-Benz Stadium",
  "Atlanta",
  "2026-06-18T16:00:00.000Z",
  "12:00",
  "America/New_York"
  ],
  [
  "2026-06-18",
  "Group A",
  "Mexico",
  "South Korea",
  "Estadio Akron",
  "Zapopan",
  "2026-06-18T19:00:00.000Z",
  "12:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-18",
  "Group B",
  "Switzerland",
  "Bosnia and Herzegovina",
  "SoFi Stadium",
  "Inglewood",
  "2026-06-18T22:00:00.000Z",
  "15:00",
  "America/Vancouver"
  ],
  [
  "2026-06-18",
  "Group B",
  "Canada",
  "Qatar",
  "BC Place",
  "Vancouver",
  "2026-06-19T01:00:00.000Z",
  "19:00",
  "America/Mexico_City"
  ],
  [
  "2026-06-19",
  "Group C",
  "Scotland",
  "Morocco",
  "Lincoln Financial Field",
  "Philadelphia",
  "2026-06-19T19:00:00.000Z",
  "12:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-19",
  "Group C",
  "Brazil",
  "Haiti",
  "Gillette Stadium",
  "Foxborough",
  "2026-06-19T22:00:00.000Z",
  "18:00",
  "America/New_York"
  ],
  [
  "2026-06-19",
  "Group D",
  "Turkiye",
  "Paraguay",
  "Levi's Stadium",
  "Santa Clara",
  "2026-06-20T00:30:00.000Z",
  "20:30",
  "America/New_York"
  ],
  [
  "2026-06-19",
  "Group D",
  "United States",
  "Australia",
  "Lumen Field",
  "Seattle",
  "2026-06-20T03:00:00.000Z",
  "20:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-20",
  "Group E",
  "Germany",
  "Ivory Coast",
  "BMO Field",
  "Toronto",
  "2026-06-20T17:00:00.000Z",
  "12:00",
  "America/Chicago"
  ],
  [
  "2026-06-20",
  "Group E",
  "Ecuador",
  "Curacao",
  "Arrowhead Stadium",
  "Kansas City",
  "2026-06-20T20:00:00.000Z",
  "16:00",
  "America/Toronto"
  ],
  [
  "2026-06-20",
  "Group F",
  "Netherlands",
  "Sweden",
  "NRG Stadium",
  "Houston",
  "2026-06-21T00:00:00.000Z",
  "19:00",
  "America/Chicago"
  ],
  [
  "2026-06-20",
  "Group F",
  "Tunisia",
  "Japan",
  "Estadio BBVA",
  "Guadalupe",
  "2026-06-21T04:00:00.000Z",
  "22:00",
  "America/Mexico_City"
  ],
  [
  "2026-06-21",
  "Group G",
  "Belgium",
  "Iran",
  "SoFi Stadium",
  "Inglewood",
  "2026-06-21T16:00:00.000Z",
  "12:00",
  "America/New_York"
  ],
  [
  "2026-06-21",
  "Group G",
  "New Zealand",
  "Egypt",
  "BC Place",
  "Vancouver",
  "2026-06-21T19:00:00.000Z",
  "12:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-21",
  "Group H",
  "Uruguay",
  "Cape Verde",
  "Hard Rock Stadium",
  "Miami Gardens",
  "2026-06-21T22:00:00.000Z",
  "18:00",
  "America/New_York"
  ],
  [
  "2026-06-21",
  "Group H",
  "Spain",
  "Saudi Arabia",
  "Mercedes-Benz Stadium",
  "Atlanta",
  "2026-06-22T01:00:00.000Z",
  "18:00",
  "America/Vancouver"
  ],
  [
  "2026-06-22",
  "Group I",
  "Norway",
  "Senegal",
  "MetLife Stadium",
  "East Rutherford",
  "2026-06-22T17:00:00.000Z",
  "12:00",
  "America/Chicago"
  ],
  [
  "2026-06-22",
  "Group I",
  "France",
  "Iraq",
  "Lincoln Financial Field",
  "Philadelphia",
  "2026-06-22T21:00:00.000Z",
  "17:00",
  "America/New_York"
  ],
  [
  "2026-06-22",
  "Group J",
  "Argentina",
  "Austria",
  "AT&T Stadium",
  "Arlington",
  "2026-06-23T00:00:00.000Z",
  "20:00",
  "America/New_York"
  ],
  [
  "2026-06-22",
  "Group J",
  "Jordan",
  "Algeria",
  "Levi's Stadium",
  "Santa Clara",
  "2026-06-23T03:00:00.000Z",
  "20:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-23",
  "Group K",
  "Portugal",
  "Uzbekistan",
  "NRG Stadium",
  "Houston",
  "2026-06-23T17:00:00.000Z",
  "12:00",
  "America/Chicago"
  ],
  [
  "2026-06-23",
  "Group K",
  "Colombia",
  "DR Congo",
  "Estadio Akron",
  "Zapopan",
  "2026-06-23T20:00:00.000Z",
  "16:00",
  "America/New_York"
  ],
  [
  "2026-06-23",
  "Group L",
  "England",
  "Ghana",
  "Gillette Stadium",
  "Foxborough",
  "2026-06-23T23:00:00.000Z",
  "19:00",
  "America/Toronto"
  ],
  [
  "2026-06-23",
  "Group L",
  "Panama",
  "Croatia",
  "BMO Field",
  "Toronto",
  "2026-06-24T02:00:00.000Z",
  "20:00",
  "America/Mexico_City"
  ],
  [
  "2026-06-24",
  "Group A",
  "Czechia",
  "Mexico",
  "Estadio Azteca",
  "Mexico City",
  "2026-06-24T19:00:00.000Z",
  "12:00",
  "America/Vancouver"
  ],
  [
  "2026-06-24",
  "Group A",
  "South Africa",
  "South Korea",
  "Estadio BBVA",
  "Guadalupe",
  "2026-06-24T19:00:00.000Z",
  "12:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-24",
  "Group B",
  "Switzerland",
  "Canada",
  "BC Place",
  "Vancouver",
  "2026-06-24T22:00:00.000Z",
  "18:00",
  "America/New_York"
  ],
  [
  "2026-06-24",
  "Group B",
  "Bosnia and Herzegovina",
  "Qatar",
  "Lumen Field",
  "Seattle",
  "2026-06-24T22:00:00.000Z",
  "18:00",
  "America/New_York"
  ],
  [
  "2026-06-24",
  "Group C",
  "Scotland",
  "Brazil",
  "Hard Rock Stadium",
  "Miami Gardens",
  "2026-06-25T01:00:00.000Z",
  "19:00",
  "America/Mexico_City"
  ],
  [
  "2026-06-24",
  "Group C",
  "Morocco",
  "Haiti",
  "Mercedes-Benz Stadium",
  "Atlanta",
  "2026-06-25T01:00:00.000Z",
  "19:00",
  "America/Mexico_City"
  ],
  [
  "2026-06-25",
  "Group D",
  "Turkiye",
  "United States",
  "SoFi Stadium",
  "Inglewood",
  "2026-06-25T20:00:00.000Z",
  "16:00",
  "America/New_York"
  ],
  [
  "2026-06-25",
  "Group D",
  "Paraguay",
  "Australia",
  "Levi's Stadium",
  "Santa Clara",
  "2026-06-25T20:00:00.000Z",
  "16:00",
  "America/New_York"
  ],
  [
  "2026-06-25",
  "Group E",
  "Curacao",
  "Ivory Coast",
  "Lincoln Financial Field",
  "Philadelphia",
  "2026-06-25T23:00:00.000Z",
  "18:00",
  "America/Chicago"
  ],
  [
  "2026-06-25",
  "Group E",
  "Ecuador",
  "Germany",
  "MetLife Stadium",
  "East Rutherford",
  "2026-06-25T23:00:00.000Z",
  "18:00",
  "America/Chicago"
  ],
  [
  "2026-06-25",
  "Group F",
  "Japan",
  "Sweden",
  "AT&T Stadium",
  "Arlington",
  "2026-06-26T02:00:00.000Z",
  "19:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-25",
  "Group F",
  "Tunisia",
  "Netherlands",
  "Arrowhead Stadium",
  "Kansas City",
  "2026-06-26T02:00:00.000Z",
  "19:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-26",
  "Group G",
  "Egypt",
  "Iran",
  "Lumen Field",
  "Seattle",
  "2026-06-26T19:00:00.000Z",
  "15:00",
  "America/New_York"
  ],
  [
  "2026-06-26",
  "Group G",
  "New Zealand",
  "Belgium",
  "BC Place",
  "Vancouver",
  "2026-06-26T19:00:00.000Z",
  "15:00",
  "America/Toronto"
  ],
  [
  "2026-06-26",
  "Group H",
  "Cape Verde",
  "Saudi Arabia",
  "NRG Stadium",
  "Houston",
  "2026-06-27T00:00:00.000Z",
  "19:00",
  "America/Chicago"
  ],
  [
  "2026-06-26",
  "Group H",
  "Uruguay",
  "Spain",
  "Estadio Akron",
  "Zapopan",
  "2026-06-27T00:00:00.000Z",
  "18:00",
  "America/Mexico_City"
  ],
  [
  "2026-06-26",
  "Group I",
  "Norway",
  "France",
  "Gillette Stadium",
  "Foxborough",
  "2026-06-27T03:00:00.000Z",
  "20:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-26",
  "Group I",
  "Senegal",
  "Iraq",
  "BMO Field",
  "Toronto",
  "2026-06-27T03:00:00.000Z",
  "20:00",
  "America/Vancouver"
  ],
  [
  "2026-06-27",
  "Group J",
  "Algeria",
  "Austria",
  "Arrowhead Stadium",
  "Kansas City",
  "2026-06-27T21:00:00.000Z",
  "17:00",
  "America/New_York"
  ],
  [
  "2026-06-27",
  "Group J",
  "Jordan",
  "Argentina",
  "AT&T Stadium",
  "Arlington",
  "2026-06-27T21:00:00.000Z",
  "17:00",
  "America/New_York"
  ],
  [
  "2026-06-27",
  "Group K",
  "Colombia",
  "Portugal",
  "Hard Rock Stadium",
  "Miami Gardens",
  "2026-06-27T23:30:00.000Z",
  "19:30",
  "America/New_York"
  ],
  [
  "2026-06-27",
  "Group K",
  "DR Congo",
  "Uzbekistan",
  "Mercedes-Benz Stadium",
  "Atlanta",
  "2026-06-27T23:30:00.000Z",
  "19:30",
  "America/New_York"
  ],
  [
  "2026-06-27",
  "Group L",
  "Panama",
  "England",
  "MetLife Stadium",
  "East Rutherford",
  "2026-06-28T02:00:00.000Z",
  "21:00",
  "America/Chicago"
  ],
  [
  "2026-06-27",
  "Group L",
  "Croatia",
  "Ghana",
  "Lincoln Financial Field",
  "Philadelphia",
  "2026-06-28T02:00:00.000Z",
  "21:00",
  "America/Chicago"
  ],
  [
  "2026-06-28",
  "Round of 32",
  "Runner-up Group A",
  "Runner-up Group B",
  "SoFi Stadium",
  "Inglewood",
  "2026-06-28T19:00:00.000Z",
  "12:00",
  "America/Los_Angeles"
  ],
  [
  "2026-06-29",
  "Round of 32",
  "Winner Group E",
  "3rd Group A/B/C/D/F",
  "Gillette Stadium",
  "Foxborough",
  "2026-06-29T17:00:00.000Z",
  "12:00",
  "America/Chicago"
  ],
  [
  "2026-06-29",
  "Round of 32",
  "Winner Group F",
  "Runner-up Group C",
  "Estadio BBVA",
  "Guadalupe",
  "2026-06-29T20:30:00.000Z",
  "16:30",
  "America/New_York"
  ],
  [
  "2026-06-29",
  "Round of 32",
  "Winner Group C",
  "Runner-up Group F",
  "NRG Stadium",
  "Houston",
  "2026-06-30T01:00:00.000Z",
  "19:00",
  "America/Mexico_City"
  ],
  [
  "2026-06-30",
  "Round of 32",
  "Winner Group I",
  "3rd Group C/D/F/G/H",
  "MetLife Stadium",
  "East Rutherford",
  "2026-06-30T17:00:00.000Z",
  "12:00",
  "America/Chicago"
  ],
  [
  "2026-06-30",
  "Round of 32",
  "Runner-up Group E",
  "Runner-up Group I",
  "AT&T Stadium",
  "Arlington",
  "2026-06-30T21:00:00.000Z",
  "17:00",
  "America/New_York"
  ],
  [
  "2026-06-30",
  "Round of 32",
  "Winner Group A",
  "3rd Group C/E/F/H/I",
  "Estadio Azteca",
  "Mexico City",
  "2026-07-01T01:00:00.000Z",
  "19:00",
  "America/Mexico_City"
  ],
  [
  "2026-07-01",
  "Round of 32",
  "Winner Group L",
  "3rd Group E/H/I/J/K",
  "Mercedes-Benz Stadium",
  "Atlanta",
  "2026-07-01T16:00:00.000Z",
  "12:00",
  "America/New_York"
  ],
  [
  "2026-07-01",
  "Round of 32",
  "Winner Group D",
  "3rd Group B/E/F/I/J",
  "Levi's Stadium",
  "Santa Clara",
  "2026-07-01T20:00:00.000Z",
  "13:00",
  "America/Los_Angeles"
  ],
  [
  "2026-07-01",
  "Round of 32",
  "Winner Group G",
  "3rd Group A/E/H/I/J",
  "Lumen Field",
  "Seattle",
  "2026-07-02T00:00:00.000Z",
  "17:00",
  "America/Los_Angeles"
  ],
  [
  "2026-07-02",
  "Round of 32",
  "Runner-up Group K",
  "Runner-up Group L",
  "BMO Field",
  "Toronto",
  "2026-07-02T19:00:00.000Z",
  "12:00",
  "America/Los_Angeles"
  ],
  [
  "2026-07-02",
  "Round of 32",
  "Winner Group H",
  "Runner-up Group J",
  "SoFi Stadium",
  "Inglewood",
  "2026-07-02T23:00:00.000Z",
  "19:00",
  "America/Toronto"
  ],
  [
  "2026-07-02",
  "Round of 32",
  "Winner Group B",
  "3rd Group E/F/G/I/J",
  "BC Place",
  "Vancouver",
  "2026-07-03T03:00:00.000Z",
  "20:00",
  "America/Vancouver"
  ],
  [
  "2026-07-03",
  "Round of 32",
  "Winner Group J",
  "Runner-up Group H",
  "Hard Rock Stadium",
  "Miami Gardens",
  "2026-07-03T18:00:00.000Z",
  "13:00",
  "America/Chicago"
  ],
  [
  "2026-07-03",
  "Round of 32",
  "Winner Group K",
  "3rd Group D/E/I/J/L",
  "Arrowhead Stadium",
  "Kansas City",
  "2026-07-03T22:00:00.000Z",
  "18:00",
  "America/New_York"
  ],
  [
  "2026-07-03",
  "Round of 32",
  "Runner-up Group D",
  "Runner-up Group G",
  "AT&T Stadium",
  "Arlington",
  "2026-07-04T01:30:00.000Z",
  "20:30",
  "America/Chicago"
  ],
  [
  "2026-07-04",
  "Round of 16",
  "Winner Match 74",
  "Winner Match 77",
  "Lincoln Financial Field",
  "Philadelphia",
  "2026-07-04T21:00:00.000Z",
  "17:00",
  "America/New_York"
  ],
  [
  "2026-07-04",
  "Round of 16",
  "Winner Match 73",
  "Winner Match 75",
  "NRG Stadium",
  "Houston",
  "2026-07-04T17:00:00.000Z",
  "12:00",
  "America/Chicago"
  ],
  [
  "2026-07-05",
  "Round of 16",
  "Winner Match 76",
  "Winner Match 78",
  "MetLife Stadium",
  "East Rutherford",
  "2026-07-05T20:00:00.000Z",
  "16:00",
  "America/New_York"
  ],
  [
  "2026-07-05",
  "Round of 16",
  "Winner Match 79",
  "Winner Match 80",
  "Estadio Azteca",
  "Mexico City",
  "2026-07-06T00:00:00.000Z",
  "18:00",
  "America/Mexico_City"
  ],
  [
  "2026-07-06",
  "Round of 16",
  "Winner Match 83",
  "Winner Match 84",
  "AT&T Stadium",
  "Arlington",
  "2026-07-06T19:00:00.000Z",
  "14:00",
  "America/Chicago"
  ],
  [
  "2026-07-06",
  "Round of 16",
  "Winner Match 81",
  "Winner Match 82",
  "Lumen Field",
  "Seattle",
  "2026-07-07T00:00:00.000Z",
  "17:00",
  "America/Los_Angeles"
  ],
  [
  "2026-07-07",
  "Round of 16",
  "Winner Match 86",
  "Winner Match 88",
  "Mercedes-Benz Stadium",
  "Atlanta",
  "2026-07-07T16:00:00.000Z",
  "12:00",
  "America/New_York"
  ],
  [
  "2026-07-07",
  "Round of 16",
  "Winner Match 85",
  "Winner Match 87",
  "BC Place",
  "Vancouver",
  "2026-07-07T20:00:00.000Z",
  "13:00",
  "America/Vancouver"
  ],
  [
  "2026-07-09",
  "Quarter-finals",
  "Winner Match 89",
  "Winner Match 90",
  "Gillette Stadium",
  "Foxborough",
  "2026-07-09T20:00:00.000Z",
  "16:00",
  "America/New_York"
  ],
  [
  "2026-07-10",
  "Quarter-finals",
  "Winner Match 93",
  "Winner Match 94",
  "SoFi Stadium",
  "Inglewood",
  "2026-07-10T19:00:00.000Z",
  "12:00",
  "America/Los_Angeles"
  ],
  [
  "2026-07-11",
  "Quarter-finals",
  "Winner Match 91",
  "Winner Match 92",
  "Hard Rock Stadium",
  "Miami Gardens",
  "2026-07-11T21:00:00.000Z",
  "17:00",
  "America/New_York"
  ],
  [
  "2026-07-11",
  "Quarter-finals",
  "Winner Match 95",
  "Winner Match 96",
  "Arrowhead Stadium",
  "Kansas City",
  "2026-07-12T01:00:00.000Z",
  "20:00",
  "America/Chicago"
  ],
  [
  "2026-07-14",
  "Semi-finals",
  "Winner Match 97",
  "Winner Match 98",
  "AT&T Stadium",
  "Arlington",
  "2026-07-14T19:00:00.000Z",
  "14:00",
  "America/Chicago"
  ],
  [
  "2026-07-15",
  "Semi-finals",
  "Winner Match 99",
  "Winner Match 100",
  "Mercedes-Benz Stadium",
  "Atlanta",
  "2026-07-15T19:00:00.000Z",
  "15:00",
  "America/New_York"
  ],
  [
  "2026-07-18",
  "Third-place play-off",
  "Loser Match 101",
  "Loser Match 102",
  "Hard Rock Stadium",
  "Miami Gardens",
  "2026-07-18T21:00:00.000Z",
  "17:00",
  "America/New_York"
  ],
  [
  "2026-07-19",
  "Final",
  "Winner Match 101",
  "Winner Match 102",
  "MetLife Stadium",
  "East Rutherford",
  "2026-07-19T19:00:00.000Z",
  "15:00",
  "America/New_York"
  ]
];

let matches = rawMatches.map((item, index) => ({
  id: `M${index + 1}`,
  date: item[0],
  phase: item[1],
  home: item[2],
  away: item[3],
  stadium: item[4],
  city: item[5],
  kickoffUtc: item[6],
  kickoffLocal: item[7],
  stadiumTz: item[8]
}));

const state = {
  currentUser: null,
  token: localStorage.getItem("wc_auth_token") || "",
  predictions: {},
  groupBy: "date",
  search: "",
  phase: "all",
  team: "all"
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const kickoffDateFormatter = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const kickoffTimeFormatter = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" });

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function loadMatches() {
  try {
    const data = await api("/api/matches");
    if (Array.isArray(data.matches) && data.matches.length) {
      matches = data.matches;
    }
  } catch (error) {
    console.warn("Using bundled match seed because matches could not be loaded from MongoDB.", error);
  }
}

function kickoffDate(match) {
  return kickoffDateFormatter.format(new Date(match.kickoffUtc));
}

function kickoffTime(match) {
  return kickoffTimeFormatter.format(new Date(match.kickoffUtc));
}

function kickoffLabel(match) {
  return `${kickoffDate(match)} - ${kickoffTime(match)} (${userTimeZone})`;
}

function hasMatchStarted(match) {
  return Date.now() >= new Date(match.kickoffUtc).getTime();
}

function fillSelects() {
  const phaseSelect = $("#phaseFilter");
  const teamSelect = $("#teamFilter");
  phaseSelect.replaceChildren(new Option("All phases", "all"));
  teamSelect.replaceChildren(new Option("All teams", "all"));
  [...new Set(matches.map((match) => match.phase))].forEach((phase) => {
    phaseSelect.append(new Option(phase, phase));
  });

  const realTeams = [...new Set(matches.flatMap((match) => [match.home, match.away]))]
    .filter((team) => !/^(Winner|Runner-up|Loser|3rd)/.test(team))
    .sort();
  realTeams.forEach((team) => teamSelect.append(new Option(team, team)));
}

function filteredMatches() {
  const query = state.search.trim().toLowerCase();
  return matches.filter((match) => {
    const phaseOk = state.phase === "all" || match.phase === state.phase;
    const teamOk = state.team === "all" || match.home === state.team || match.away === state.team;
    const queryOk = !query || [match.id, match.date, kickoffDate(match), kickoffTime(match), match.phase, match.home, match.away, match.stadium, match.city]
      .join(" ")
      .toLowerCase()
      .includes(query);
    return phaseOk && teamOk && queryOk;
  });
}

function groupMatches(items) {
  const groups = new Map();
  items.forEach((match) => {
    let keys;
    if (state.groupBy === "team") {
      keys = [match.home, match.away].filter((team) => !/^(Winner|Runner-up|Loser|3rd)/.test(team));
      if (!keys.length) keys = ["Knockout placeholders"];
    } else if (state.groupBy === "phase") {
      keys = [match.phase];
    } else {
      keys = [kickoffDate(match)];
    }
    keys.forEach((key) => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(match);
    });
  });
  return groups;
}

function clearFilters() {
  state.search = "";
  state.phase = "all";
  state.team = "all";
  $("#searchInput").value = "";
  $("#phaseFilter").value = "all";
  $("#teamFilter").value = "all";
  renderMatches();
}

function renderMatches() {
  const container = $("#matches");
  const predictions = state.predictions;
  const items = filteredMatches();
  const groups = groupMatches(items);
  container.replaceChildren();

  $("#matchCount").textContent = items.length;
  $("#savedCount").textContent = Object.keys(predictions).length;
  $("#activeView").textContent = $(`.segment[data-group="${state.groupBy}"]`).textContent;

  if (!items.length) {
    const empty = document.createElement("section");
    empty.className = "group";
    const header = document.createElement("div");
    header.className = "group-header";
    header.innerHTML = "<h2>No matches found</h2>";
    const clearButton = document.createElement("button");
    clearButton.className = "ghost";
    clearButton.type = "button";
    clearButton.textContent = "Clear filters";
    clearButton.addEventListener("click", clearFilters);
    header.append(clearButton);
    empty.append(header);
    container.append(empty);
    return;
  }

  groups.forEach((groupItems, title) => {
    const section = document.createElement("section");
    section.className = "group";
    const header = document.createElement("div");
    header.className = "group-header";
    header.innerHTML = `<h2>${title}</h2><span>${groupItems.length} matches</span>`;
    const list = document.createElement("div");
    list.className = "match-list";
    groupItems.forEach((match) => list.append(renderCard(match, predictions[match.id])));
    section.append(header, list);
    container.append(section);
  });
}

function renderCard(match, prediction) {
  const node = $("#matchTemplate").content.firstElementChild.cloneNode(true);
  $(".phase", node).textContent = `${match.id} - ${match.phase}`;
  $(".date", node).textContent = kickoffLabel(match);
  $(".home", node).textContent = match.home;
  $(".away", node).textContent = match.away;
  const venueParts = [match.stadium, match.city]
    .map((value) => String(value || "").trim())
    .filter((value) => value && value.toUpperCase() !== "TBD");
  const venue = $(".venue", node);
  venue.textContent = [...new Set(venueParts)].join(", ");
  venue.classList.toggle("hidden", !venue.textContent);
  $(".home-label", node).textContent = match.home;
  $(".away-label", node).textContent = match.away;

  const homeScore = $(".home-score", node);
  const awayScore = $(".away-score", node);
  const stateLine = $(".prediction-state", node);
  const form = $(".prediction", node);
  const saveButton = $("button", form);
  const locked = hasMatchStarted(match);
  if (prediction) {
    homeScore.value = prediction.home;
    awayScore.value = prediction.away;
    stateLine.textContent = `Saved: ${match.home} ${prediction.home} - ${prediction.away} ${match.away}`;
  } else {
    stateLine.textContent = state.currentUser ? "No prediction yet" : "Log in to save";
  }
  if (locked) {
    homeScore.disabled = true;
    awayScore.disabled = true;
    saveButton.disabled = true;
    stateLine.textContent = prediction
      ? `Locked after kickoff: ${match.home} ${prediction.home} - ${prediction.away} ${match.away}`
      : "Locked after kickoff";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (hasMatchStarted(match)) {
      stateLine.textContent = "Predictions are locked after kickoff.";
      return;
    }
    if (!state.currentUser) {
      stateLine.textContent = "Please register or log in first.";
      return;
    }
    if (homeScore.value === "" || awayScore.value === "") {
      stateLine.textContent = "Enter both scores.";
      return;
    }
    try {
      stateLine.textContent = "Saving...";
      const data = await api(`/api/predictions/${match.id}`, {
        method: "PUT",
        body: JSON.stringify({
          home: Number(homeScore.value),
          away: Number(awayScore.value)
        })
      });
      state.predictions[match.id] = {
        home: data.prediction.home,
        away: data.prediction.away,
        savedAt: new Date().toISOString()
      };
      renderMatches();
    } catch (error) {
      stateLine.textContent = error.message;
    }
  });

  return node;
}

function renderAuth() {
  const loggedIn = Boolean(state.currentUser);
  const user = state.currentUser;
  $("#sessionName").textContent = loggedIn ? `Signed in as ${user.name || user.email}` : "";
  $("#guestActions").classList.toggle("hidden", loggedIn);
  $("#logoutBtn").classList.toggle("hidden", !loggedIn);
}

function bindEvents() {
  $("#logoutBtn").addEventListener("click", () => {
    state.currentUser = null;
    state.token = "";
    state.predictions = {};
    localStorage.removeItem("wc_auth_token");
    renderAuth();
    renderMatches();
  });
  $$(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      state.groupBy = button.dataset.group;
      $$(".segment").forEach((item) => item.classList.toggle("active", item === button));
      renderMatches();
    });
  });
  $("#searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderMatches();
  });
  $("#phaseFilter").addEventListener("change", (event) => {
    state.phase = event.target.value;
    renderMatches();
  });
  $("#teamFilter").addEventListener("change", (event) => {
    state.team = event.target.value;
    renderMatches();
  });
  $("#clearFiltersBtn").addEventListener("click", clearFilters);
}

async function restoreSession() {
  if (!state.token) return;
  try {
    const data = await api("/api/session");
    state.currentUser = data.user;
    await loadPredictions();
  } catch {
    state.token = "";
    state.predictions = {};
    localStorage.removeItem("wc_auth_token");
  }
}

async function loadPredictions() {
  if (!state.currentUser) {
    state.predictions = {};
    return;
  }
  const data = await api("/api/predictions");
  state.predictions = data.predictions || {};
}

async function init() {
  await loadMatches();
  fillSelects();
  bindEvents();
  await restoreSession();
  renderAuth();
  renderMatches();
}

init();
