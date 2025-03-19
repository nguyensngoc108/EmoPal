import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TherapistService from '../../services/TherapistServices';
import TherapistCard from './TherapistCard';
import { CheckIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

const Spinner = ({ size = "sm" }) => (
  <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600 ${
    size === "sm" ? "h-4 w-4" : "h-8 w-8"
  }`}></div>
);

const TherapistResults = ({ filters, skipWizard = false }) => {
  const navigate = useNavigate();
  const [therapists, setTherapists] = useState([]);
  const [filteredTherapists, setFilteredTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilters, setActiveFilters] = useState(filters || {});
  const [showFilters, setShowFilters] = useState(false);
  const [sortOption, setSortOption] = useState('rating');

  // Fetch therapists on initial load
  useEffect(() => {
    fetchTherapists();
  }, []);

  // Apply filters whenever activeFilters change
  useEffect(() => {
    if (therapists.length) {
      applyFilters();
    }
  }, [activeFilters, sortOption, therapists]);

  const fetchTherapists = async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);

      // Build API parameters from filters
      const params = { 
        page: pageNum, 
        limit: 10,
        skip: (pageNum - 1) * 10  // Add skip parameter for proper pagination
      };
      
      // Apply all active filters to the API request
      Object.keys(activeFilters).forEach(key => {
        if (activeFilters[key]) {
          if (key === 'priceRange') {
            params.minPrice = activeFilters[key][0];
            params.maxPrice = activeFilters[key][1];
          } else if (key === 'preferredLanguages' && activeFilters[key].length) {
            params.languages = activeFilters[key].join(',');
          } else if (key === 'preferredGender' && activeFilters[key] !== 'no_preference') {
            params.gender = activeFilters[key];
          } else if (key === 'preferredApproach' && activeFilters[key] !== 'no_preference') {
            params.approach = activeFilters[key];
          } else if (activeFilters[key]) {
            params[key] = activeFilters[key];
          }
        }
      });

      const response = await TherapistService.getTherapists(params);
      
      if (pageNum === 1) {
        setTherapists(response.data.therapists || []);
      } else {
        // Append new results to existing therapists
        setTherapists(prev => [...prev, ...(response.data.therapists || [])]);
      }
      
      // Check if there are more results to load
      setHasMore(response.data.therapists?.length === 10);
      setPage(pageNum);
    } catch (err) {
      console.error("Error fetching therapists:", err);
      setError("Failed to load therapists. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...therapists];

    // Apply active filters
    if (activeFilters.serviceType) {
      filtered = filtered.filter(t => 
        t.specialization?.includes(activeFilters.serviceType) ||
        t.focus_areas?.includes(activeFilters.serviceType)
      );
    }
    
    if (activeFilters.helpReason) {
      filtered = filtered.filter(t => 
        t.specialization?.includes(activeFilters.helpReason) ||
        t.focus_areas?.includes(activeFilters.helpReason)
      );
    }
    
    if (activeFilters.preferredGender && activeFilters.preferredGender !== 'no_preference') {
      filtered = filtered.filter(t => t.gender === activeFilters.preferredGender);
    }
    
    if (activeFilters.preferredLanguages?.length) {
      filtered = filtered.filter(t => 
        t.languages?.some(lang => activeFilters.preferredLanguages.includes(lang.toLowerCase()))
      );
    }
    
    if (activeFilters.priceRange) {
      const [min, max] = activeFilters.priceRange;
      filtered = filtered.filter(t => 
        t.hourly_rate >= min && t.hourly_rate <= max
      );
    }
    
    if (activeFilters.preferredApproach && activeFilters.preferredApproach !== 'no_preference') {
      filtered = filtered.filter(t => 
        t.approach_methods?.includes(activeFilters.preferredApproach)
      );
    }

    // Apply sorting
    if (sortOption === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortOption === 'price_low') {
      filtered.sort((a, b) => (a.hourly_rate || 1000) - (b.hourly_rate || 1000));
    } else if (sortOption === 'price_high') {
      filtered.sort((a, b) => (b.hourly_rate || 0) - (a.hourly_rate || 0));
    } else if (sortOption === 'experience') {
      filtered.sort((a, b) => (b.years_experience || 0) - (a.years_experience || 0));
    }

    setFilteredTherapists(filtered);
  };

  const loadMore = () => {
    fetchTherapists(page + 1);
  };

  const handleViewProfile = (therapistId) => {
    navigate(`/therapists/${therapistId}`);
  };

  const handleBookSession = (therapist) => {
    navigate(`/book-session/${therapist._id}`);
  };

  const handleFilterChange = (key, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setActiveFilters({});
  };

  return (
    <div className="therapist-results">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Therapists</h2>
          {!loading && !error && (
            <p className="text-gray-600">
              {filteredTherapists.length} therapists available
            </p>
          )}
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <select
              className="w-full sm:w-auto appearance-none rounded-md border border-gray-300 py-2 pl-3 pr-10 text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
            >
              <option value="rating">Top Rated</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="experience">Most Experienced</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"></path>
              </svg>
            </div>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2" />
            Filters
          </button>
        </div>
      </div>
      
      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white p-4 rounded-md shadow-md mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Filter Results</h3>
            <button 
              onClick={clearFilters}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Clear all
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Add filter controls here */}
            <button 
              onClick={() => setShowFilters(false)}
              className="md:col-span-3 mt-2 inline-flex justify-center items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <CheckIcon className="h-5 w-5 mr-2" />
              Apply Filters
            </button>
          </div>
        </div>
      )}
      
      {/* Content */}
      {loading && page === 1 ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-500 mb-2">{error}</div>
          <button 
            onClick={() => fetchTherapists()}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Try Again
          </button>
        </div>
      ) : filteredTherapists.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No matching therapists found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your filters or try again later.</p>
          <button 
            onClick={clearFilters}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-600 mb-4">
            Found {filteredTherapists.length} therapists matching your criteria
          </div>
          
          <div className="space-y-6">
            {filteredTherapists.map(therapist => (
              <TherapistCard 
                key={therapist._id} 
                therapist={therapist} 
                onViewProfile={() => handleViewProfile(therapist._id)}
                onBookSession={() => handleBookSession(therapist)}
              />
            ))}
          </div>
          
          {loading && page > 1 && (
            <div className="flex justify-center py-4">
              <Spinner size="md" />
            </div>
          )}
          
          {hasMore && !loading && (
            <div className="flex justify-center mt-8">
              <button 
                onClick={loadMore}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TherapistResults;