'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { NEXT_PUBLIC_API_BASE_URL } from '@/lib/env';

export default function SalesforceConnectPage() {
  const [showApiKey, setShowApiKey] = useState(true);
  const [copied, setCopied] = useState(false);

  const apiKeyValue = NEXT_PUBLIC_API_BASE_URL + '/client_API_IN_DB';

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKeyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Salesforce Connect</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label className="mb-2">Salseforce Login URL</Label>
            <Input
              type="text"
              disabled
              value={
                'https://platform-agility-5432--realestate.sandbox.my.salesforce.com/services/data/v59.0/sobjects/AVL_Deal_Unit__c'
              }
            />
          </div>
          <div className="mb-4">
            <Label className="mb-2">Salesforce API URL</Label>
            <Input
              type="text"
              placeholder="https://your-instance.salesforce.com/services/data/v59.0"
            />
          </div>
          <div>
            <Label className="mb-2">Platform API Key</Label>
            <div className="flex items-center gap-2">
              <Input
                type={showApiKey ? 'text' : 'password'}
                disabled
                value={apiKeyValue}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowApiKey(!showApiKey)}
                type="button"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={handleCopy} type="button">
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
