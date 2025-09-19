# Deployment Guide

## Vercel Deployment

1. **Push to GitHub**: Make sure your code is in a GitHub repository

2. **Connect to Vercel**: 
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect it's a Next.js project

3. **Set up Vercel KV**:
   - In your Vercel dashboard, go to the Storage tab
   - Create a new KV database
   - Copy the environment variables to your project settings
   - The required environment variables are:
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN` 
     - `KV_REST_API_READ_ONLY_TOKEN`

4. **Deploy**: Vercel will automatically deploy your app

## Environment Variables

Make sure these are set in your Vercel project settings:

```
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token  
KV_REST_API_READ_ONLY_TOKEN=your_kv_rest_api_read_only_token
```

## Local Development

For local development, you can either:

1. **Use Vercel KV locally**: Set up the environment variables in a `.env.local` file
2. **Mock the KV calls**: Temporarily comment out the KV calls and use a simple in-memory store

## Troubleshooting

- **KV Connection Issues**: Make sure your environment variables are correctly set
- **API Rate Limits**: The Met Museum API has a rate limit of 80 requests per second
- **CORS Issues**: The Met Museum API should work without CORS issues, but if you encounter any, check your API calls

