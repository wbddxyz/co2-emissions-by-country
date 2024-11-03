const express = require('express');
const axios = require('axios');
const csv = require('csv-parser');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware to serve static files
app.use(express.static(path.join(__dirname)));

// Route for the home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route for the ways to reduce carbon footprint page
app.get('/reduce-footprint', (req, res) => {
  res.sendFile(path.join(__dirname, 'reduce-footprint.html'));
});

// Endpoint for countries
app.get('/api/countries', async (req, res) => {
  try {
    const response = await axios.get('https://restcountries.com/v3.1/all');
    const countries = response.data.map(country => country.name.common);
    res.json(countries);
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).send('Error fetching countries');
  }
});

// Function to fetch CO2 emissions data by country
async function getCO2DataByCountry(country) {
  const url = 'https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv';
  const data = []; // Array to hold emissions data for the specified country

  console.log(`Fetching CO2 data for: ${country}`);

  try {
    const response = await axios.get(url, { responseType: 'stream' });
    return new Promise((resolve, reject) => {
      response.data
        .pipe(csv())
        .on('data', (row) => {
          if (row.country === country) {
            data.push({
              year: row.year,
              co2: row.co2,
              co2_per_capita: row.co2_per_capita
            });
          }
        })
        .on('end', () => {
          console.log(`Data for ${country}:`, data); // Log the final data array
          resolve(data);
        })
        .on('error', (error) => {
          console.error('Error processing CSV data:', error);
          reject(error);
        });
    });
  } catch (error) {
    console.error('Error fetching CO₂ data:', error);
    return [];
  }
}

// CO₂ emissions endpoint
app.get('/api/co2-emissions', async (req, res) => {
  const country = req.query.country;

  if (!country) {
    return res.status(400).json({ error: 'Country is required' });
  }

  try {
    const data = await getCO2DataByCountry(country);
    res.json(data);
  } catch (error) {
    console.error('Error fetching CO₂ data:', error);
    res.status(500).json({ error: 'An error occurred while fetching CO₂ data' });
  }
});

// Route for the main causes of CO2 pollution page
app.get('/causes', (req, res) => {
  res.sendFile(path.join(__dirname, 'causes.html'));
});

// Function to fetch top three CO2 emitters
async function fetchTopEmitters() {
  const url = 'https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv';
  const countryEmissions = {};

  // Exclude entries based on patterns in names
  const excludePatterns = [
    /^World$/, /^Asia/, /^Europe/, /^Africa/, /^North America/, /^South America/, /^Oceania/,
    /European Union/, /High-income/, /Low-income/, /Upper-middle-income/, /Lower-middle-income/,
    /Non-OECD/, /OECD/, /^G20$/, /^G7$/, /\(GCP\)/
  ];

  try {
    const response = await axios.get(url, { responseType: 'stream' });
    return new Promise((resolve, reject) => {
      response.data
        .pipe(csv())
        .on('data', (row) => {
          const country = row.country;
          const year = parseInt(row.year, 10);
          const co2 = parseFloat(row.co2);

          // Check if the country matches any exclusion pattern
          const isExcluded = excludePatterns.some((pattern) => pattern.test(country));

          if (!isNaN(co2) && !isExcluded) {
            if (!countryEmissions[country] || countryEmissions[country].year < year) {
              countryEmissions[country] = { year, co2 };
            }
          }
        })
        .on('end', () => {
          const topEmitters = Object.entries(countryEmissions)
            .sort((a, b) => b[1].co2 - a[1].co2)
            .slice(0, 3)
            .map(([country, data]) => ({
              country,
              year: data.year,
              co2: data.co2,
            }));
          resolve(topEmitters);
        })
        .on('error', (error) => reject(error));
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    return [];
  }
}

// Endpoint to get top three CO2 emitters
app.get('/api/top-emitters', async (req, res) => {
  const topEmitters = await fetchTopEmitters();
  res.json(topEmitters);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
