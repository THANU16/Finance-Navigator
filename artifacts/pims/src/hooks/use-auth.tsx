import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const TOKEN_KEY = "pims_auth_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function useAuth() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const token = getAuthToken();
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);

  const { data: user, isLoading, error } = useGetCurrentUser({
    query: {
      enabled: !!token,
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
    }
  });

  useEffect(() => {
    if (error) {
      clearAuthToken();
      setIsAuthenticated(false);
      queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
    }
  }, [error, queryClient]);

  const login = useCallback((token: string) => {
    setAuthToken(token);
    setIsAuthenticated(true);
    // query is enabled on token change so it will fetch user
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setIsAuthenticated(false);
    queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
    setLocation("/login");
  }, [setLocation, queryClient]);

  return {
    user,
    isLoading: isAuthenticated && isLoading,
    isAuthenticated,
    login,
    logout
  };
}
