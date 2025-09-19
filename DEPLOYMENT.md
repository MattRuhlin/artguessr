# Deployment Guide

## Vercel Deployment

1. **Push to GitHub**: Make sure your code is in a GitHub repository

2. **Connect to Vercel**: 
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect it's a Next.js project

3. **Set up Upstash Redis (Serverless Redis)**:
   - In your Vercel dashboard, open your project and go to the Integrations/Storage tab
   - Add the “Serverless Redis” (Upstash Redis) integration and create a database
   - The integration will add environment variables to your project settings:
     - `UPSTASH_REDIS_REST_URL`
     - `UPSTASH_REDIS_REST_TOKEN`

4. **Deploy**: Vercel will automatically deploy your app

## Environment Variables

Make sure these are set in your Vercel project settings (Preview and Production):

```
UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
```

## Local Development

For local development, you can either:

1. **Use Upstash locally**: Put the env vars in `.env.local` and run `npm run dev` or `vercel dev`
2. **Mock the Redis calls**: For offline work, replace Redis calls with an in-memory store

## Troubleshooting

- **Redis Connection Issues**: Make sure your environment variables are correctly set
- **API Rate Limits**: The Met Museum API has a rate limit of 80 requests per second
- **CORS Issues**: The Met Museum API should work without CORS issues, but if you encounter any, check your API calls

