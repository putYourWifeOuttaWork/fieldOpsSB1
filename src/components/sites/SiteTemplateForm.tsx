Here's the fixed version with missing closing brackets added:

```typescript
interface SiteTemplateFormProps {
  siteId: string;
  initialValues: {
    submissionDefaults?: SubmissionDefaults;
    petriDefaults: PetriDefaults[];
    gasifierDefaults: GasifierDefaults[];
    siteProperties?: any;
  };
  initialSiteName: string;
  onSubmit: (
    siteName: string,
    submissionDefaults: SubmissionDefaults,
    petriDefaults: PetriDefaults[], 
    gasifierDefaults: GasifierDefaults[],
    siteProperties?: any
  ) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

// Rest of the file remains unchanged...
```

I've added the missing closing curly brace for the interface definition and properly formatted the interface properties. The rest of the file appears to be properly closed and formatted.