# Astro with Tailwind

```sh
npm create astro@latest -- --template with-tailwindcss
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/with-tailwindcss)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/with-tailwindcss)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/with-tailwindcss/devcontainer.json)

Astro comes with [Tailwind](https://tailwindcss.com) support out of the box. This example showcases how to style your Astro project with Tailwind.

For complete setup instructions, please see our [Tailwind Integration Guide](https://docs.astro.build/en/guides/integrations-guide/tailwind).

# 3D Fit Analysis App

A comprehensive 3D garment fit analysis application built with Astro, Three.js, and modern web technologies.

## Features

- **3D Model Visualization**: Upload and view 3D garment models with interactive controls
- **Body-Garment Relationship Analysis**: Measure distances between body and garment at multiple levels
- **Comprehensive Fit Reports**: Generate detailed fit analysis reports with pass/fail criteria
- **AI-Powered Analysis**: Get intelligent insights and recommendations using Gemini AI
- **Cross-Section Charts**: Visualize body and garment cross-sections with Chart.js
- **Print-Ready Reports**: Export fit reports as PDF or print-friendly formats

## AI Analysis Feature

The application now includes an AI-powered fit analysis feature that uses Google's Gemini AI to provide intelligent insights about garment fit quality. This feature:

- Analyzes fit test data and provides comprehensive assessments
- Identifies key areas of concern and priority adjustments
- Generates specific recommendations for improvement
- Provides a fit quality rating (1-10 scale)
- Works with fallback analysis when AI is unavailable

### Setting up Gemini AI Integration

1. **Get a Gemini API Key**:

   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key for Gemini Pro
   - Copy the API key

2. **Configure Environment Variables**:
   Create a `.env` file in your project root:

   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

3. **API Endpoint**:
   The AI analysis is handled by the `/api/gemini-analysis` endpoint, which:
   - Receives fit test data and summary statistics
   - Sends a structured prompt to Gemini AI
   - Parses the AI response into actionable insights
   - Provides fallback analysis if the AI service is unavailable

### AI Analysis Data Structure

The AI receives the following data for analysis:

- Pass/fail statistics and percentages
- Top 5 variations by measurement difference
- Body levels and landmarks analyzed
- Tolerance settings and measurement counts
- Complete test data for context

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Building

```bash
npm run build
```

## Usage

1. **Upload Models**: Start by uploading your 3D garment models
2. **Define Fit**: Set up fit parameters and tolerance levels
3. **Analyze Fit**: Run the fit analysis across different body levels
4. **Generate Report**: Create comprehensive fit reports with AI insights
5. **Export Results**: Print or download reports for further analysis

## Technologies Used

- **Astro**: Modern static site generator
- **Three.js**: 3D graphics and visualization
- **Chart.js**: Data visualization and charts
- **Tailwind CSS**: Utility-first CSS framework
- **TypeScript**: Type-safe JavaScript development
- **Gemini AI**: Google's AI model for intelligent analysis

## Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Application pages and API routes
├── scripts/            # Core analysis and utility functions
├── styles/             # Global styles and CSS
└── types/              # TypeScript type definitions
```

## API Endpoints

- `/api/gemini-analysis`: AI-powered fit analysis using Gemini
- Additional endpoints for data processing and model management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
#   3 d - f i t - p r o t o 
 
 
