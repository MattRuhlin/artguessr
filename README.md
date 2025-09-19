# ArtGuessr

A GeoGuessr-style game for art lovers! Test your knowledge of art history by guessing where famous artworks were created.

## How to Play

1. Look at the artwork displayed on the left
2. Click on the world map where you think the artwork was created
3. Get points based on how close your guess is to the actual location
4. Play 5 rounds and try to achieve the highest score possible!

## Features

- **5 Rounds**: Each game consists of 5 different artworks from The Met Museum's collection
- **Scoring System**: Points are awarded based on distance accuracy (0-5000 points per round)
- **Leaderboard**: Compete with others and see if you can make it to the top 10
- **Real Artworks**: All images are from The Metropolitan Museum of Art's Open Access collection

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript and React
- **Styling**: Tailwind CSS
- **Maps**: Leaflet with OpenStreetMap tiles
- **Data**: The Met Museum Collection API
- **Database**: Vercel KV for leaderboard storage
- **Deployment**: Vercel

## API Endpoints

- `GET /api/random-object` - Fetches a random artwork from The Met Museum
- `POST /api/round/score` - Calculates score based on guess location
- `GET /api/leaderboard` - Retrieves top 10 scores
- `POST /api/leaderboard` - Submits a new score

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

This app is designed to be deployed on Vercel. Make sure to set up Vercel KV for the leaderboard functionality.

## Data Sources

- **Artworks**: [The Metropolitan Museum of Art Collection API](https://metmuseum.github.io/?utm_source=chatgpt.com#objects)
- **Maps**: OpenStreetMap tiles via Leaflet
- **Country Centroids**: Custom dataset for location scoring

## Scoring

The scoring system uses the Haversine formula to calculate the distance between your guess and the actual location:

- **Perfect guess (0km)**: 5000 points
- **2000km away**: 0 points
- **Smooth curve**: Points decrease quadratically with distance

## License

This project uses artworks from The Metropolitan Museum of Art's Open Access collection, which are available under Creative Commons Zero license.